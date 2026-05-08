import { expect, test } from '@playwright/test';

test('redirects root to the public website', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('https://www.gredice.com');
});
