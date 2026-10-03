import { expect, test } from '@playwright/test';

test('real public route never reads private data, resets on reload and restores auth on garden navigation', async ({
    page,
}) => {
    const privateRequests: string[] = [];
    const writes: string[] = [];
    const modelOrigins: string[] = [];
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.startsWith('/assets/models/'))
            modelOrigins.push(url.origin);
        if (
            !['GET', 'HEAD'].includes(request.method()) &&
            /api\/gredice/.test(request.url())
        )
            writes.push(request.url());
    });
    await page.route('**/api/gredice/**', (route) => {
        privateRequests.push(route.request().url());
        return route.fulfill({
            status: 401,
            json: { error: 'Unauthorized test visitor' },
        });
    });
    await page.goto('/staza-bundeva');
    await expect(
        page.getByRole('heading', { name: 'Staza bundeva', exact: true }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Započni stazu' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Započni stazu' }).tap();
    await page.getByRole('button', { name: 'Bundeva 3', exact: true }).tap();
    await expect(page.locator('[data-pumpkin-trail-status]')).toHaveText(
        'Upaljeno 1 od 5 bundeva.',
    );
    expect(privateRequests).toEqual([]);
    expect(writes).toEqual([]);
    await expect.poll(() => modelOrigins.length).toBeGreaterThan(0);
    expect([...new Set(modelOrigins)]).toEqual([new URL(page.url()).origin]);
    await page.reload();
    await expect(page.locator('[data-pumpkin-trail-status]')).toContainText(
        'prvi korak',
    );
    await page.getByRole('link', { name: 'Posjeti Kestenijadu' }).click();
    await expect(
        page.getByRole('heading', { name: 'Kestenijada', exact: true }),
    ).toBeVisible();
    await page
        .getByRole('link', { name: 'Posjeti stazu bundeva', exact: true })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Staza bundeva', exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-pumpkin-trail-status]')).toContainText(
        'prvi korak',
    );
    await page
        .getByRole('link', { name: 'Posjeti Kestenijadu', exact: true })
        .click();
    // Kestenijada may read its public offer directory, never an account.
    expect(
        privateRequests.filter((url) =>
            /auth\/|accounts\/|gardens\/|presence/.test(url),
        ),
    ).toEqual([]);
    await page.getByRole('link', { name: 'Otvori vrt', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect
        .poll(() =>
            privateRequests.some((url) => url.includes('/auth/current-claims')),
        )
        .toBe(true);
    await page.goBack();
    await expect(
        page.getByRole('heading', { name: 'Kestenijada', exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(
        page.getByRole('heading', { name: 'Staza bundeva', exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-pumpkin-trail-status]')).toContainText(
        'prvi korak',
    );
    expect(writes).toEqual([]);
});

test('unavailable model fails visibly and refresh retries a fresh public scene', async ({
    page,
}) => {
    await page.route('**/assets/models/PumpkinLanternSmile.glb*', (route) =>
        route.abort(),
    );
    await page.goto('/staza-bundeva');
    await expect(
        page
            .getByRole('alert')
            .filter({ hasText: 'Stazu nije moguće prikazati' }),
    ).toContainText('Stazu nije moguće prikazati');
    await expect(
        page.getByRole('button', { name: 'Započni stazu' }),
    ).toHaveCount(0);
    await page.unroute('**/assets/models/PumpkinLanternSmile.glb*');
    await page.getByRole('button', { name: 'Osvježi stranicu' }).click();
    await expect(
        page.getByRole('button', { name: 'Započni stazu' }),
    ).toBeEnabled();
    await expect(page.locator('[data-pumpkin-trail-status]')).toContainText(
        'prvi korak',
    );
});
