import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { GET as flush } from '../../app/api/live/flush/route';
import { POST as ingest } from '../../app/api/live/ingest/[source]/route';
import { GET as retention } from '../../app/api/live/retention/route';

test('signed buffered ingestion accepts only durable writes and returns retryable failures', async (t) => {
    const previous = { ...process.env };
    t.after(() => {
        process.env = previous;
    });
    Object.assign(process.env, {
        GREDICE_LIVE_INGEST_MODE: 'buffered',
        GREDICE_LIVE_INGEST_DATABASE_URL:
            'postgres://private:secret@database.invalid/db',
        GREDICE_LIVE_BUFFER_REST_API_URL: 'https://buffer.invalid',
        GREDICE_LIVE_BUFFER_REST_API_TOKEN: 'private-buffer-token',
        GREDICE_LIVE_VERCEL_DRAIN_SECRET: 'test-secret',
        GREDICE_LIVE_GITHUB_WEBHOOK_SECRET: 'test-secret',
        CRON_SECRET: 'test-cron',
    });
    let result = 'buffered';
    const transport = t.mock.method(
        globalThis,
        'fetch',
        async (
            _input: Parameters<typeof fetch>[0],
            init?: Parameters<typeof fetch>[1],
        ) => {
            assert.doesNotMatch(
                String(init?.body),
                /private body|private repository|external-delivery-id/,
            );
            return Response.json(
                result === 'error' ? { error: 'provider failure' } : { result },
            );
        },
    );
    t.mock.method(console, 'error', () => undefined);
    const body = JSON.stringify([
        { source: 'lambda', timestamp: Date.now(), message: 'private body' },
    ]);
    const signature = createHmac('sha1', 'test-secret')
        .update(body)
        .digest('hex');
    const send = (value = signature) =>
        ingest(
            new Request('http://localhost/api/live/ingest/vercel', {
                method: 'POST',
                body,
                headers: { 'x-vercel-signature': value },
            }),
            { params: Promise.resolve({ source: 'vercel' }) },
        );
    assert.equal((await send('invalid')).status, 401);
    assert.equal(transport.mock.callCount(), 0);
    for (const accepted of ['buffered', 'duplicate']) {
        result = accepted;
        assert.equal((await send()).status, 202);
    }
    for (const unavailable of ['full', 'stale', 'error']) {
        result = unavailable;
        assert.equal((await send()).status, 503);
    }
    result = 'buffered';
    const githubBody = JSON.stringify({
        repository: { name: 'private repository' },
    });
    const githubSignature = createHmac('sha256', 'test-secret')
        .update(githubBody)
        .digest('hex');
    const response = await ingest(
        new Request('http://localhost/api/live/ingest/github', {
            method: 'POST',
            body: githubBody,
            headers: {
                'x-hub-signature-256': `sha256=${githubSignature}`,
                'x-github-delivery': 'external-delivery-id',
                'x-github-event': 'push',
            },
        }),
        { params: Promise.resolve({ source: 'github' }) },
    );
    assert.equal(response.status, 202);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});

test('flush and retention cron routes require auth and no-op before buffer activation', async (t) => {
    const previous = { ...process.env };
    t.after(() => {
        process.env = previous;
    });
    process.env.CRON_SECRET = 'test-cron';
    process.env.GREDICE_LIVE_INGEST_MODE = 'direct';
    for (const route of [flush, retention]) {
        assert.equal(
            (await route(new Request('http://localhost/cron'))).status,
            401,
        );
        const response = await route(
            new Request('http://localhost/cron', {
                headers: { Authorization: 'Bearer test-cron' },
            }),
        );
        assert.deepEqual(await response.json(), { status: 'disabled' });
        assert.equal(
            response.headers.get('Cache-Control'),
            'private, no-store',
        );
    }
});

test('large signed raw records and many buckets are sanitized into accepted bounded records', async (t) => {
    const previous = { ...process.env };
    t.after(() => {
        process.env = previous;
    });
    Object.assign(process.env, {
        GREDICE_LIVE_INGEST_MODE: 'buffered',
        GREDICE_LIVE_BUFFER_REST_API_URL: 'https://buffer.invalid',
        GREDICE_LIVE_BUFFER_REST_API_TOKEN: 'test',
        GREDICE_LIVE_VERCEL_DRAIN_SECRET: 'test-secret',
        CRON_SECRET: 'test',
    });
    const admitted: unknown[] = [];
    t.mock.method(
        globalThis,
        'fetch',
        async (
            _input: Parameters<typeof fetch>[0],
            init?: Parameters<typeof fetch>[1],
        ) => {
            const command = JSON.parse(String(init?.body));
            const raw = command[4 + Number(command[2])];
            assert.ok(Buffer.byteLength(raw) <= 16 * 1024);
            assert.doesNotMatch(raw, /private-record/u);
            admitted.push(JSON.parse(raw));
            return Response.json({ result: 'buffered' });
        },
    );
    const body = JSON.stringify(
        Array.from({ length: 500 }, (_, i) => ({
            source: 'lambda',
            timestamp: Date.now() - i * 60_000,
            message:
                i === 0
                    ? `private-record${'x'.repeat(20_000)}`
                    : 'private-record',
        })),
    );
    const response = await ingest(
        new Request('http://localhost/api/live/ingest/vercel', {
            method: 'POST',
            body,
            headers: {
                'x-vercel-signature': createHmac('sha1', 'test-secret')
                    .update(body)
                    .digest('hex'),
            },
        }),
        { params: Promise.resolve({ source: 'vercel' }) },
    );
    assert.equal(response.status, 202);
    assert.ok(admitted.length > 1);
});
