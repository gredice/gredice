import type { Page } from '@playwright/test';
import { expect, type Locator, test } from './fixtures';

async function typeSearch(locator: Locator, value: string) {
    await locator.click();
    await locator.pressSequentially(value);
    await expect(locator).toHaveValue(value);
    await expect(locator).toBeFocused();
}

async function expectSearchParam(page: Page, name: string, value: string) {
    await expect
        .poll(() => new URL(page.url()).searchParams.get(name), {
            timeout: 10_000,
        })
        .toBe(value);
}

test.describe('public search filters', () => {
    test('navbar search opens inline command results on desktop', async ({
        page,
    }) => {
        await page.route(
            '**/api/gredice/api/directories/search**',
            async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 250));
                await route.fulfill({
                    contentType: 'application/json',
                    json: {
                        query: 'rajcica',
                        limit: 8,
                        offset: 0,
                        count: 2,
                        results: [
                            {
                                entityId: 1,
                                entityType: 'plant',
                                category: 'plants',
                                categoryLabel: 'Biljke',
                                title: 'Rajčica',
                                summary: 'Sočna vrtna biljka za ljeto.',
                                imageUrl: '/assets/plants/placeholder.png',
                                imageAlt: 'Rajčica na biljci',
                                href: 'https://www.gredice.com/biljke/rajcica',
                                rank: 1,
                                publishedAt: null,
                                updatedAt: '2026-01-01T00:00:00.000Z',
                            },
                            {
                                entityId: 2,
                                entityType: 'operation',
                                category: 'operations',
                                categoryLabel: 'Radnje',
                                title: 'Zalijevanje',
                                summary: 'Dodavanje vode u gredicu.',
                                imageUrl: null,
                                imageAlt: null,
                                visualKey: 'watering',
                                href: 'https://www.gredice.com/radnje/zalijevanje',
                                rank: 0.8,
                                publishedAt: null,
                                updatedAt: '2026-01-01T00:00:00.000Z',
                            },
                        ],
                    },
                    status: 200,
                });
            },
        );

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const expectedShortcut = await page.evaluate(() =>
            /Mac|iPhone|iPad|iPod/u.test(
                navigator.platform || navigator.userAgent,
            )
                ? '⌘K'
                : 'Ctrl K',
        );
        await expect(
            page.getByText(expectedShortcut, { exact: true }),
        ).toBeVisible();

        await page.keyboard.press(
            expectedShortcut === '⌘K' ? 'Meta+K' : 'Control+K',
        );
        const searchInput = page.getByRole('combobox', { name: 'Pretraga' });
        await expect(searchInput).toBeFocused();
        await searchInput.fill('rajcica');
        await expect(searchInput).toHaveValue('rajcica');
        await expect(searchInput).toHaveAttribute('placeholder', 'Pretraga...');
        await expect(searchInput).toBeFocused();

        const searchDialog = page.getByRole('dialog', { name: 'Pretraga' });
        await expect(searchDialog).toBeVisible();
        await expect(
            searchDialog.getByText('Pretraga...', { exact: true }),
        ).toBeVisible();
        await expect(
            searchDialog.locator('.gredice-loading-indicator__bar'),
        ).toBeVisible();
        await expect(
            searchDialog.getByRole('option', { name: /Rajčica/ }),
        ).toBeVisible();
        await expect(
            searchDialog.getByRole('img', { name: 'Rajčica na biljci' }),
        ).toBeVisible();
        await expect(
            searchDialog.locator('[data-search-result-icon="watering"]'),
        ).toBeVisible();
        await expect(
            searchDialog.getByRole('link', { name: 'Prikaži više rezultata' }),
        ).toHaveCount(0);
    });

    test('navbar search links to full results when the inline limit is reached', async ({
        page,
    }) => {
        await page.route(
            '**/api/gredice/api/directories/search**',
            async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    json: {
                        query: 'snow',
                        limit: 8,
                        offset: 0,
                        count: 8,
                        results: Array.from({ length: 8 }, (_, index) => ({
                            entityId: index + 1,
                            entityType: 'block',
                            category: 'blocks',
                            categoryLabel: 'Blokovi',
                            title: `Snijeg ${index + 1}`,
                            summary: 'Dekorativni blok za gredicu.',
                            imageUrl: null,
                            imageAlt: null,
                            href: `https://www.gredice.com/blokovi/snijeg-${index + 1}`,
                            rank: 1 - index * 0.01,
                            publishedAt: null,
                            updatedAt: '2026-01-01T00:00:00.000Z',
                        })),
                    },
                    status: 200,
                });
            },
        );

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const expectedShortcut = await page.evaluate(() =>
            /Mac|iPhone|iPad|iPod/u.test(
                navigator.platform || navigator.userAgent,
            )
                ? '⌘K'
                : 'Ctrl K',
        );
        await expect(
            page.getByText(expectedShortcut, { exact: true }),
        ).toBeVisible();
        await page.keyboard.press(
            expectedShortcut === '⌘K' ? 'Meta+K' : 'Control+K',
        );
        const searchInput = page.getByRole('combobox', { name: 'Pretraga' });
        await expect(searchInput).toBeFocused();
        await searchInput.fill('snow');
        await expect(
            page.getByRole('dialog', { name: 'Pretraga' }),
        ).toBeVisible();

        const moreResultsLink = page.getByRole('link', {
            name: 'Prikaži više rezultata',
        });
        await expect(moreResultsLink).toBeVisible();
        await expect(moreResultsLink).toHaveAttribute(
            'href',
            '/pretraga?pretraga=snow',
        );
    });

    test('navbar search refines results by type', async ({ page }) => {
        const requestedCategories: Array<string | null> = [];
        await page.route(
            '**/api/gredice/api/directories/search**',
            async (route) => {
                const url = new URL(route.request().url());
                const category = url.searchParams.get('category');
                requestedCategories.push(category);
                await route.fulfill({
                    contentType: 'application/json',
                    json: {
                        query: 'luk',
                        limit: 8,
                        offset: 0,
                        count: category === 'operations' ? 1 : 3,
                        results:
                            category === 'operations'
                                ? [
                                      {
                                          entityId: 3,
                                          entityType: 'operation',
                                          category: 'operations',
                                          categoryLabel: 'Radnje',
                                          title: 'Zalijevanje',
                                          summary: 'Dodavanje vode u gredicu.',
                                          imageUrl: null,
                                          imageAlt: null,
                                          visualKey: 'watering',
                                          href: 'https://www.gredice.com/radnje/zalijevanje',
                                          rank: 1,
                                          publishedAt: null,
                                          updatedAt: '2026-01-01T00:00:00.000Z',
                                      },
                                  ]
                                : [
                                      {
                                          entityId: 1,
                                          entityType: 'plant',
                                          category: 'plants',
                                          categoryLabel: 'Biljke',
                                          title: 'Luk',
                                          summary: 'Biljka iz porodice lukova.',
                                          imageUrl: null,
                                          imageAlt: null,
                                          href: 'https://www.gredice.com/biljke/luk',
                                          rank: 1,
                                          publishedAt: null,
                                          updatedAt: '2026-01-01T00:00:00.000Z',
                                      },
                                      {
                                          entityId: 2,
                                          entityType: 'plantSort',
                                          category: 'sorts',
                                          categoryLabel: 'Sorte',
                                          title: 'Snowball',
                                          summary: 'Bijela sorta luka.',
                                          imageUrl: null,
                                          imageAlt: null,
                                          href: 'https://www.gredice.com/biljke/luk/sorte/snowball',
                                          rank: 0.9,
                                          publishedAt: null,
                                          updatedAt: '2026-01-01T00:00:00.000Z',
                                      },
                                      {
                                          entityId: 3,
                                          entityType: 'operation',
                                          category: 'operations',
                                          categoryLabel: 'Radnje',
                                          title: 'Zalijevanje',
                                          summary: 'Dodavanje vode u gredicu.',
                                          imageUrl: null,
                                          imageAlt: null,
                                          visualKey: 'watering',
                                          href: 'https://www.gredice.com/radnje/zalijevanje',
                                          rank: 0.8,
                                          publishedAt: null,
                                          updatedAt: '2026-01-01T00:00:00.000Z',
                                      },
                                  ],
                    },
                    status: 200,
                });
            },
        );

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const expectedShortcut = await page.evaluate(() =>
            /Mac|iPhone|iPad|iPod/u.test(
                navigator.platform || navigator.userAgent,
            )
                ? '⌘K'
                : 'Ctrl K',
        );
        await expect(
            page.getByText(expectedShortcut, { exact: true }),
        ).toBeVisible();
        await page.keyboard.press(
            expectedShortcut === '⌘K' ? 'Meta+K' : 'Control+K',
        );
        const searchInput = page.getByRole('combobox', { name: 'Pretraga' });
        await expect(searchInput).toBeFocused();
        await searchInput.fill('luk');

        const searchDialog = page.getByRole('dialog', { name: 'Pretraga' });
        await expect(searchDialog).toBeVisible();
        for (const label of [
            'Sve',
            'Biljke',
            'Sorte',
            'Radnje',
            'Blokovi',
            'Sjeme',
        ]) {
            await expect(
                searchDialog.getByRole('button', { name: label }),
            ).toBeVisible();
        }
        await expect(
            searchDialog.getByRole('button', { name: 'Sve' }),
        ).toHaveAttribute('aria-pressed', 'true');
        await expect(
            searchDialog.getByRole('option', { name: /Luk/ }),
        ).toBeVisible();
        await expect(
            searchDialog.getByRole('option', { name: /Snowball/ }),
        ).toBeVisible();

        await searchDialog
            .getByRole('button', { name: 'Radnje' })
            .press('Enter');
        await expect(searchInput).toBeFocused();
        await expect(
            searchDialog.getByRole('button', { name: 'Radnje' }),
        ).toHaveAttribute('aria-pressed', 'true');
        await expect(
            searchDialog.getByRole('option', { name: /Zalijevanje/ }),
        ).toBeVisible();
        await expect(
            searchDialog.getByRole('option', { name: /Snowball/ }),
        ).toHaveCount(0);
        expect(requestedCategories).toContain('operations');
    });

    test('navbar search hides shortcut hints on touch devices', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'maxTouchPoints', {
                get: () => 1,
            });
        });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('⌘K', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Ctrl K', { exact: true })).toHaveCount(0);
    });

    test('navbar search avoids primary link overlap', async ({ page }) => {
        await page.setViewportSize({ width: 1180, height: 720 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(
            page.locator('header search[aria-label="Pretraga"]'),
        ).toBeHidden();
        await expect(
            page.getByRole('button', { name: 'Pretraga' }),
        ).toBeVisible();

        await page.setViewportSize({ width: 1280, height: 720 });
        const searchBox = await page
            .locator('header search[aria-label="Pretraga"]')
            .boundingBox();
        const raisedBedLinkBox = await page
            .locator('header')
            .getByRole('link', { name: 'Gredica', exact: true })
            .boundingBox();
        const firstNavLinkBox = await page
            .locator('header')
            .getByRole('link', { name: 'Biljke', exact: true })
            .boundingBox();

        expect(searchBox).not.toBeNull();
        expect(raisedBedLinkBox).not.toBeNull();
        expect(firstNavLinkBox).not.toBeNull();
        expect((searchBox?.x ?? 0) + (searchBox?.width ?? 0)).toBeLessThan(
            (raisedBedLinkBox?.x ?? 0) - 8,
        );
        expect(
            (raisedBedLinkBox?.x ?? 0) + (raisedBedLinkBox?.width ?? 0),
        ).toBeLessThan((firstNavLinkBox?.x ?? 0) - 4);
        expect(raisedBedLinkBox?.x ?? 0).toBeLessThan(firstNavLinkBox?.x ?? 0);
    });

    test('navbar exposes updated primary links', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const navbar = page.locator('header');
        await expect(
            navbar.getByRole('link', { name: 'Gredica', exact: true }),
        ).toHaveAttribute('href', '/podignuta-gredica');
        await expect(
            navbar.getByRole('link', { name: 'Radnje', exact: true }),
        ).toHaveAttribute('href', '/radnje');
    });

    test('navbar search uses compact mobile button', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const searchButton = page.getByRole('button', { name: 'Pretraga' });
        await expect(searchButton).toBeVisible();
        await page.waitForTimeout(250);
        await searchButton.click();

        const searchDialog = page.getByRole('dialog', { name: 'Pretraga' });
        await expect(searchDialog).toBeVisible();
        await expect(
            searchDialog.getByRole('combobox', { name: 'Pretraga' }),
        ).toBeFocused();
    });

    test('plant search keeps keyboard focus and ignores Croatian diacritics', async ({
        page,
    }) => {
        await page.goto('/biljke', { waitUntil: 'load' });

        const searchInput = page.locator('#plant-search');
        await typeSearch(searchInput, 'rajcica');

        await expectSearchParam(page, 'pretraga', 'rajcica');
        await expect(page.getByText('Rajčica', { exact: true })).toBeVisible();
        await expect(page.getByText('Nema rezultata pretrage.')).toBeHidden();
    });

    test('operation search keeps keyboard focus and ignores Croatian diacritics', async ({
        page,
    }) => {
        await page.goto('/radnje', { waitUntil: 'load' });

        const searchInput = page.locator('#operation-search');
        await typeSearch(searchInput, 'ciscenje');

        await expectSearchParam(page, 'pretraga', 'ciscenje');
        await expect(
            page.getByText('Čišćenje gredice', { exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Nema dostupnih radnji.')).toBeHidden();
    });

    test('global search page renders search controls', async ({ page }) => {
        const response = await page.goto('/pretraga', {
            waitUntil: 'domcontentloaded',
        });

        expect(response?.status()).toBe(200);
        await expect(
            page.getByRole('heading', { name: 'Pretraga' }),
        ).toBeVisible();
        await expect(
            page.getByRole('textbox', { name: 'Pretraga' }),
        ).toHaveAttribute('placeholder', 'Pretraga...');
        for (const label of [
            'Sve',
            'Biljke',
            'Sorte',
            'Radnje',
            'Blokovi',
            'Sjeme',
        ]) {
            await expect(
                page.getByRole('button', { name: label }),
            ).toBeVisible();
        }
    });
});
