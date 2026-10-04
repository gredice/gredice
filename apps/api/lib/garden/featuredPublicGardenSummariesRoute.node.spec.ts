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
