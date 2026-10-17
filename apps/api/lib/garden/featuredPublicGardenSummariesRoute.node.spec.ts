import assert from 'node:assert/strict';
import test from 'node:test';
import { featuredPublicGardenSummariesRoute } from './featuredPublicGardenSummariesRoute';

test('public summaries keep privacy-sensitive responses out of HTTP caches and stay below 10 KB', async () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
        garden: { id: index + 1, name: `Vrt ${index + 1}` },
        owner: {
            publicId: `u_${index + 1}`,
            displayName: `Vrtlar ${index + 1}`,
            avatarUrl: 'https://cdn.gredice.com/avatar.webp',
            achievementCount: 3,
        },
        dayPreviewImageUrl: `https://cdn.gredice.com/garden-${index + 1}-day.webp`,
        nightPreviewImageUrl: `https://cdn.gredice.com/garden-${index + 1}-night.webp`,
    }));
    const response = await featuredPublicGardenSummariesRoute(
        async () => items,
    ).request('/public/featured/summaries');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(
        response.headers.get('server-timing') ?? '',
        /^featured-summaries;dur=\d+\.\d$/u,
    );
    const body = await response.text();
    assert.ok(Buffer.byteLength(body) < 10_000);
    assert.deepEqual(JSON.parse(body), { items });
    assert.doesNotMatch(
        body,
        /accountId|userName|raisedBeds|stacks|operations/,
    );
});

test('an empty summary list succeeds and repository failures remain failures', async () => {
    const empty = await featuredPublicGardenSummariesRoute(
        async () => [],
    ).request('/public/featured/summaries');
    assert.deepEqual(await empty.json(), { items: [] });
    const unavailable = featuredPublicGardenSummariesRoute(async () => {
        throw new Error('Unavailable');
    });
    unavailable.onError((_error, context) =>
        context.json({ error: 'Unavailable' }, 503),
    );
    assert.equal(
        (await unavailable.request('/public/featured/summaries')).status,
        503,
    );
});

test('summary requests correlate handler entry, completion and response using only a valid UUID', async (t) => {
    const logs = t.mock.method(console, 'info', () => {});
    const traceId = 'bb4b532e-8c47-4160-8a3a-b60cf94b5a2e';
    const response = await featuredPublicGardenSummariesRoute(async () => {
        assert.deepEqual(logs.mock.calls[0]?.arguments, [
            'Featured garden summaries request started',
            { traceId },
        ]);
        return [];
    }).request('/public/featured/summaries', {
        headers: { 'x-gredice-featured-trace': traceId },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-gredice-featured-trace'), traceId);
    assert.equal(logs.mock.callCount(), 2);
    assert.equal(
        logs.mock.calls[1]?.arguments[0],
        'Featured garden summaries request completed',
    );
    assert.equal(logs.mock.calls[1]?.arguments[1]?.traceId, traceId);
    assert.equal(typeof logs.mock.calls[1]?.arguments[1]?.durationMs, 'number');
});

test('untrusted trace text is neither logged nor reflected in a summary response', async (t) => {
    const logs = t.mock.method(console, 'info', () => {});
    for (const traceId of [
        undefined,
        'private@example.com',
        'a'.repeat(1_000),
    ]) {
        const response = await featuredPublicGardenSummariesRoute(
            async () => [],
        ).request('/public/featured/summaries', {
            headers: traceId ? { 'x-gredice-featured-trace': traceId } : {},
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-gredice-featured-trace'), null);
    }
    assert.equal(logs.mock.callCount(), 0);
});

test('a traced summary failure preserves the HTTP error without logging storage details', async (t) => {
    const info = t.mock.method(console, 'info', () => {});
    const errors = t.mock.method(console, 'error', () => {});
    const traceId = 'bb4b532e-8c47-4160-8a3a-b60cf94b5a2e';
    const failure = new Error('private repository details');
    const app = featuredPublicGardenSummariesRoute(async () => {
        throw failure;
    });
    app.onError((error, context) => {
        assert.equal(error, failure);
        return context.json({ error: 'Unavailable' }, 503);
    });
    const response = await app.request('/public/featured/summaries', {
        headers: { 'x-gredice-featured-trace': traceId },
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('x-gredice-featured-trace'), traceId);
    assert.equal(info.mock.callCount(), 1);
    assert.equal(errors.mock.callCount(), 1);
    assert.equal(
        errors.mock.calls[0]?.arguments[0],
        'Featured garden summaries request failed',
    );
    const context = errors.mock.calls[0]?.arguments[1];
    assert.partialDeepStrictEqual(context, { traceId, errorName: 'Error' });
    assert.equal(typeof context?.durationMs, 'number');
    assert.doesNotMatch(
        JSON.stringify(errors.mock.calls),
        /private repository details/u,
    );
});
