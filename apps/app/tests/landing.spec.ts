import { expect, test } from '@playwright/test';

test('redirects root to admin login page', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('/admin');
});
