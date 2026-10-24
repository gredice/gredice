import assert from 'node:assert/strict';
import test from 'node:test';
import { featuredPublicGardensRoute } from './featuredPublicGardensRoute';

test('featured IDs are public, fresh and timed without loading detail data', async () => {
    const app = featuredPublicGardensRoute(async () => [{ id: 4 }, { id: 2 }]);
    const response = await app.request('/public/featured');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(
        response.headers.get('server-timing') ?? '',
        /^featured-list;dur=\d+\.\d$/u,
    );
    assert.deepEqual(await response.json(), { items: [{ id: 4 }, { id: 2 }] });
});

test('an empty featured list remains a successful response', async () => {
    const response = await featuredPublicGardensRoute(async () => []).request(
        '/public/featured',
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [] });
});

test('a valid trace correlates handler entry and completion without logging request data', async (t) => {
    const started = t.mock.method(console, 'info', () => {});
    const traceId = '6b29852c-814b-4e63-96f1-38a09f0b4264';
    const response = await featuredPublicGardensRoute(async () => [
        { id: 7 },
    ]).request('/public/featured', {
        headers: { 'x-gredice-featured-trace': traceId },
    });
    assert.equal(response.status, 200);
    assert.equal(started.mock.callCount(), 2);
    assert.deepEqual(started.mock.calls[0]?.arguments, [
        'Featured garden list request started',
        { traceId },
    ]);
    assert.equal(started.mock.calls[1]?.arguments[1]?.traceId, traceId);
    assert.equal(
        typeof started.mock.calls[1]?.arguments[1]?.durationMs,
        'number',
    );
});

test('untrusted trace text is ignored', async (t) => {
    const started = t.mock.method(console, 'info', () => {});
    const response = await featuredPublicGardensRoute(async () => []).request(
        '/public/featured',
        { headers: { 'x-gredice-featured-trace': 'private@example.com' } },
    );
    assert.equal(response.status, 200);
    assert.equal(started.mock.callCount(), 0);
});

test('storage failures remain failures instead of successful empty lists', async () => {
    const app = featuredPublicGardensRoute(async () => {
        throw new Error('Unavailable');
    });
    app.onError((_error, context) =>
        context.json({ error: 'Unavailable' }, 503),
    );
    const response = await app.request('/public/featured');
    assert.equal(response.status, 503);
});
