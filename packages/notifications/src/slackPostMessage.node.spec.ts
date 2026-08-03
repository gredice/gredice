import assert from 'node:assert/strict';
import test from 'node:test';
import { postMessage } from '@gredice/slack';

test('Slack submission fence runs immediately before fetch', async (t) => {
    const calls: string[] = [];
    t.mock.method(
        globalThis,
        'fetch',
        async (_input: string | URL | Request, init?: RequestInit) => {
            calls.push('fetch');
            assert.ok(init?.signal);
            return Response.json({ ok: true, ts: '123.456' });
        },
    );

    const result = await postMessage({
        abortSignal: new AbortController().signal,
        beforeProviderSubmission: async () => {
            calls.push('fence');
        },
        channel: 'checkout-alerts',
        text: 'Checkout event',
        token: 'token',
    });

    assert.deepEqual(calls, ['fence', 'fetch']);
    assert.equal(result.ok, true);
    assert.equal(result.outcome, 'accepted');
});

test('Slack configuration errors do not cross the submission fence', async () => {
    let fenced = false;
    const result = await postMessage({
        beforeProviderSubmission: async () => {
            fenced = true;
        },
        channel: 'checkout-alerts',
        text: 'Checkout event',
    });

    assert.equal(fenced, false);
    assert.deepEqual(result, {
        ok: false,
        outcome: 'not_started',
        skipped: 'missing_token',
    });
});

test('Slack distinguishes proven rejection from uncertain transport failure', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
        Response.json({ error: 'ratelimited', ok: false }, { status: 429 }),
    );
    const rejected = await postMessage({
        channel: 'checkout-alerts',
        text: 'Checkout event',
        token: 'token',
    });
    assert.equal(rejected.outcome, 'rejected');
    assert.equal(rejected.status, 429);

    fetchMock.mock.mockImplementation(async () => {
        throw new Error('connection reset');
    });
    const uncertain = await postMessage({
        channel: 'checkout-alerts',
        text: 'Checkout event',
        token: 'token',
    });
    assert.equal(uncertain.outcome, 'uncertain');
});
