import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    acquireLastLoginProvider,
    type FetchLastLogin,
} from './lastLoginProviderRequest';

async function getLastLoginProvider(fetchHint: FetchLastLogin) {
    const request = acquireLastLoginProvider(fetchHint);
    try {
        return await request.promise;
    } finally {
        request.release();
    }
}

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

test('last consumer closing evicts a pending hint without disturbing a reopened request', async () => {
    const responses: Array<(value: Response) => void> = [];
    const fetchHint = () =>
        new Promise<Response>((resolve) => responses.push(resolve));
    const first = acquireLastLoginProvider(fetchHint);
    const second = acquireLastLoginProvider(fetchHint);
    first.release();
    first.release();
    const third = acquireLastLoginProvider(fetchHint);
    assert.equal(responses.length, 1);
    second.release();
    third.release();
    const reopened = acquireLastLoginProvider(fetchHint);
    assert.equal(responses.length, 2);
    responses[0](Response.json({ provider: 'google' }));
    await first.promise;
    const concurrent = acquireLastLoginProvider(fetchHint);
    assert.equal(
        responses.length,
        2,
        'old settlement must not evict the new request',
    );
    responses[1](Response.json({ provider: 'facebook' }));
    assert.equal(await reopened.promise, 'facebook');
    assert.equal(await concurrent.promise, 'facebook');
    reopened.release();
    concurrent.release();
});
