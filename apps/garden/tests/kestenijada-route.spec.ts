import { readFile } from 'node:fs/promises';
import { kestenijadaItems } from '@gredice/js/kestenijada';
import { expect, test } from '@playwright/test';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';

// Match chromium-webgl-outlet's functional startup bound for cold game imports
// and software WebGL initialization.
const canvasStartupTimeout = 30_000;

const offers = getLocalSandboxBlockData()
    .filter((row) =>
        kestenijadaItems.some((item) => item.name === row.information.name),
    )
    .map((row, i) => ({ ...row, id: 900 + i, prices: { sunflowers: 10 } }));

test.afterEach(async () => {
    // HTTP 200 and a rendered page can hide a failed runtime prerender pass.
    const serverLog = await readFile(
        '.next/kestenijada-route-server.log',
        'utf8',
    );
    expect(serverLog).not.toMatch(/Error: Route "\/"|while prerendering/);
});

for (const signedIn of [false, true]) {
    test(`homepage prerenders and renders for a signed-${signedIn ? 'in' : 'out'} visitor`, async ({
        page,
    }) => {
        const pageErrors: string[] = [];
        const privateRequests: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        // The signed-out login dialog makes the background inert. This
        // prerender check still verifies that the discovery link is painted.
        const discoveryLink = page.getByRole('link', {
            name: 'Posjeti Kestenijadu',
            includeHidden: !signedIn,
        });
        const user = {
            id: 'prerender-test-user',
            userName: 'prerender-test-user',
            displayName: 'Test vrtlar',
            isTemporary: false,
            createdAt: '2026-01-01T00:00:00Z',
            birthday: null,
            birthdayLastRewardAt: null,
            birthdayLastUpdatedAt: null,
        };
        const garden = {
            id: 1,
            name: 'Testni vrt',
            isPublic: false,
            isSandbox: false,
            backgroundPalette: 'current',
            createdAt: user.createdAt,
            updatedAt: user.createdAt,
            latitude: 45.739,
            longitude: 16.572,
            raisedBeds: [],
            stacks: {},
        };
        await page.route('**/api/gredice/**', (route) => {
            const path = new URL(route.request().url()).pathname;
            if (path.includes('/directories/entities/block'))
                return route.fulfill({ json: getLocalSandboxBlockData() });
            if (path.includes('/directories/'))
                return route.fulfill({ json: [] });
            if (path.endsWith('/data/weather/now'))
                return route.fulfill({
                    json: { cloudy: 0, temperature: 15, windSpeed: 0 },
                });
            if (path.includes('/data/weather'))
                return route.fulfill({ json: [] });
            privateRequests.push(path);
            if (path.endsWith('/auth/current-claims'))
                return route.fulfill({
                    status: signedIn ? 200 : 401,
                    json: signedIn ? user : { error: 'Unauthorized' },
                });
            if (path.endsWith('/users/current'))
                return route.fulfill({ json: user });
            if (path.endsWith('/api/gardens'))
                return route.fulfill({ json: [garden] });
            if (path.endsWith('/api/gardens/1'))
                return route.fulfill({ json: garden });
            if (path.endsWith('/accounts/gardens'))
                return route.fulfill({ json: [] });
            if (path.endsWith('/accounts/current'))
                return route.fulfill({ status: 404, json: {} });
            return route.fulfill({
                status: 404,
                json: { error: 'Unavailable fixture' },
            });
        });

        const response = await page.goto('/');
        expect(response?.status()).toBe(200);
        await expect(discoveryLink).toBeVisible();
        await expect
            .poll(() =>
                privateRequests.some((path) =>
                    path.endsWith('/auth/current-claims'),
                ),
            )
            .toBe(true);
        if (signedIn) {
            await expect(
                page.getByRole('button', { name: 'Testni vrt', exact: true }),
            ).toBeVisible();
            await expect(
                page.getByRole('dialog', { name: 'Prijava', exact: true }),
            ).toHaveCount(0);
            await expect
                .poll(() =>
                    privateRequests.some((path) =>
                        path.endsWith('/api/gardens'),
                    ),
                )
                .toBe(true);
        } else {
            await expect(
                page.getByRole('dialog', { name: 'Prijava', exact: true }),
            ).toBeVisible();
            await expect(
                page.getByRole('button', {
                    name: 'Nastavi kao gost',
                    exact: true,
                }),
            ).toBeVisible();
            await expect(
                page.getByRole('button', { name: 'Testni vrt', exact: true }),
            ).toHaveCount(0);
        }
        await expect(page.locator('canvas')).toBeVisible({
            timeout: canvasStartupTimeout,
        });
        await page.reload();
        await expect(discoveryLink).toBeVisible();
        expect(pageErrors).toEqual([]);
    });
}

test('direct public route and real Link transition fence private reads while preserving authenticated routes', async ({
    page,
}) => {
    const privateRequests: string[] = [];
    const modelOrigins: string[] = [];
    let temporaryAccountCreated = false;
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
        if (url.endsWith('/data/weather/now'))
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
        if (url.includes('/data/weather')) return route.fulfill({ json: [] });
        privateRequests.push(url);
        if (url.endsWith('/api/auth/temporary')) {
            temporaryAccountCreated = true;
            return route.fulfill({ status: 201, json: {} });
        }
        if (url.includes('/auth/current-claims')) {
            if (temporaryAccountCreated)
                return route.fulfill({
                    json: {
                        id: 'kestenijada-test-guest',
                        userName: 'Test visitor',
                        isTemporary: true,
                    },
                });
            return route.fulfill({
                status: 401,
                json: { error: 'Unauthorized test visitor' },
            });
        }
        // Home may render its private scene after guest bootstrap. Keep its
        // empty garden list valid rather than returning an error object as data.
        if (
            url.endsWith('/api/gardens') ||
            url.endsWith('/api/accounts/gardens')
        )
            return route.fulfill({ json: [] });
        if (url.endsWith('/api/accounts/current'))
            return route.fulfill({ status: 404, json: {} });
        return route.fulfill({
            status: 403,
            json: { error: 'test account unavailable' },
        });
    });
    await page.goto('/kestenijada');
    await expect(
        page.getByRole('heading', { name: 'Kestenijada', exact: true }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible({
        timeout: canvasStartupTimeout,
    });
    await expect(
        page.getByRole('link', { name: /Pogledaj ponudu:/ }),
    ).toHaveCount(5);
    expect(privateRequests).toEqual([]);
    await expect.poll(() => modelOrigins.length).toBeGreaterThan(0);
    expect([...new Set(modelOrigins)]).toEqual([new URL(page.url()).origin]);
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
    await expect.poll(() => temporaryAccountCreated).toBe(true);
    await expect(
        page.getByRole('dialog', { name: 'Prijava', exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('link', { name: 'Posjeti Kestenijadu' }),
    ).toBeVisible();
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
