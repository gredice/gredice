import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLastLoginProvider } from './lastLoginProviderRequest';

test('shares an in-flight parsed response without retaining a session hint', async () => {
    let calls = 0;
    let provider: string | null = 'google';
    const fetchHint = async () => {
        calls += 1;
        return Response.json({ provider });
    };
    const hints = await Promise.all(
        Array.from({ length: 207 }, () => getLastLoginProvider(fetchHint)),
    );
    assert.equal(calls, 1);
    assert.ok(hints.every((hint) => hint === 'google'));
    provider = null;
    assert.equal(await getLastLoginProvider(fetchHint), undefined);
    assert.equal(calls, 2);
});

test('isolates endpoints and releases failed requests for retry', async () => {
    let calls = 0;
    const fetchHint = async () => {
        calls += 1;
        return calls === 1
            ? new Response(null, { status: 503 })
            : Response.json({ provider: 'facebook' });
    };
    await assert.rejects(getLastLoginProvider(fetchHint));
    assert.deepEqual(
        await Promise.all([
            getLastLoginProvider(fetchHint),
            getLastLoginProvider(async () =>
                Response.json({ provider: 'google' }),
            ),
        ]),
        ['facebook', 'google'],
    );
});
