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
