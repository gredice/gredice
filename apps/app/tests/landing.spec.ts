import { expect, test } from '@playwright/test';

test('redirects root to admin login page', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('/admin');
});

test('shows login on admin page when signed out', async ({ page, request }) => {
    const response = await request.get('/admin', { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers().location).toBeUndefined();

    await page.goto('/admin');
    await expect(
        page.getByRole('button', { name: 'Google prijava' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Facebook prijava' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Email prijava' }).click();

    await expect(
        page.getByRole('button', { name: 'Prijavi se' }),
    ).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
});
