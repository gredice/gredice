import { expect, test } from '@playwright/test';

test('redirects root to admin login page', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('/admin');
});

test('shows login on admin page when signed out', async ({ request }) => {
    const response = await request.get('/admin', { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers().location).toBeUndefined();
    await expect(response.text()).resolves.toContain('Prijava');
});
