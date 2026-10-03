import { kestenijadaItems } from '@gredice/js/kestenijada';
import { expect, test } from '@playwright/test';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';

const offers = getLocalSandboxBlockData()
    .filter((row) =>
        kestenijadaItems.some((item) => item.name === row.information.name),
    )
    .map((row, i) => ({ ...row, id: 900 + i, prices: { sunflowers: 10 } }));
test('direct public route and real Link transition fence private reads while preserving authenticated routes', async ({
    page,
}) => {
    const privateRequests: string[] = [];
    const modelOrigins: string[] = [];
    page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/assets/models/'))
            modelOrigins.push(new URL(request.url()).origin);
    });
    page.on('pageerror', (error) => console.error(error.message));
    await page.route('**/api/gredice/**', (route) => {
        const url = route.request().url();
        if (url.includes('/directories/entities/block'))
            return route.fulfill({ json: offers });
        if (url.includes('/directories/')) return route.fulfill({ json: [] });
        if (url.includes('/data/weather/'))
            return route.fulfill({
                json: {
                    cloudy: 0,
                    foggy: 0,
                    temperature: 15,
                    rainy: 0,
                    snowy: 0,
                    windSpeed: 0,
                },
            });
        privateRequests.push(url);
        if (url.includes('/auth/current-claims'))
            return route.fulfill({
                status: 401,
                json: { error: 'Unauthorized test visitor' },
            });
        return route.fulfill({
            status: 403,
            json: { error: 'test account unavailable' },
        });
    });
    await page.goto('/kestenijada');
    await expect(
        page.getByRole('heading', { name: 'Kestenijada', exact: true }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(
        page.getByRole('link', { name: /Pogledaj ponudu:/ }),
    ).toHaveCount(5);
    expect(privateRequests).toEqual([]);
    await expect.poll(() => modelOrigins.length).toBeGreaterThan(0);
    expect([...new Set(modelOrigins)]).toEqual(['http://localhost:5486']);
    await page.evaluate(() => {
        window.sessionStorage.setItem(
            'kestenijada-transition-proof',
            'same-document',
        );
    });
    await page.getByRole('link', { name: 'Otvori vrt', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect
        .poll(() =>
            privateRequests.some((url) => url.includes('/auth/current-claims')),
        )
        .toBe(true);
    await page
        .getByRole('button', { name: 'Nastavi kao gost', exact: true })
        .click();
    await expect(
        page.getByRole('dialog', { name: 'Prijava', exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('link', { name: 'Posjeti Kestenijadu' }),
    ).toBeVisible();
    // Let the authenticated page finish its own bootstrap before navigating away.
    await page.waitForTimeout(2000);
    await page.getByRole('link', { name: 'Posjeti Kestenijadu' }).click();
    await expect(page).toHaveURL(/\/kestenijada$/);
    await expect(
        page.getByRole('heading', { name: 'Kestenijada', exact: true }),
    ).toBeVisible();
    const publicMounted = privateRequests.length;
    await page.waitForTimeout(1500);
    expect(privateRequests.slice(publicMounted)).toEqual([]);
    expect(
        await page.evaluate(() =>
            sessionStorage.getItem('kestenijada-transition-proof'),
        ),
    ).toBe('same-document');
});
