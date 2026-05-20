import { expect, test } from '@playwright/test';

test('rejects too short search query', async ({ request }) => {
    const response = await request.get('/api/directories/search?q=a');
    expect(response.status()).toBe(400);
});

test('returns search payload shape for no-result query', async ({ request }) => {
    const response = await request.get(
        '/api/directories/search?q=nonexistent-search-token-zz&limit=5&offset=0',
    );
    expect([200, 500, 503]).toContain(response.status());

    const body = await response.json();
    if (response.status() === 200) {
        expect(body.query).toBe('nonexistent-search-token-zz');
        expect(body.limit).toBe(5);
        expect(body.offset).toBe(0);
        expect(Array.isArray(body.results)).toBeTruthy();
        expect(body.count).toBe(body.results.length);
    } else {
        expect(body.error).toBeTruthy();
    }
});
