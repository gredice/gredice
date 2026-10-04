import type { Request } from '@playwright/test';
import { expect, test } from './fixtures';

test.describe('WWW to News navigation', () => {
    test.setTimeout(30_000);

    for (const width of [1280, 390]) {
        for (const surface of ['header', 'footer']) {
            test(`${surface} uses a document request without News prefetch at ${width}px`, async ({
                page,
            }) => {
                await page.setViewportSize({ width, height: 900 });
                const newsRequests: Request[] = [];
                page.on('request', (request) => {
                    if (new URL(request.url()).pathname === '/novosti') {
                        newsRequests.push(request);
                    }
                });
                // Model the separate News app without requiring a second server.
                // An RSC request must fail, as in the production incident.
                await page.route(
                    (url) => url.pathname === '/novosti',
                    (route) =>
                        route.fulfill({
                            status: route.request().isNavigationRequest()
                                ? 200
                                : 404,
                            contentType: 'text/html',
                            body: '<!doctype html><html lang="hr"><title>Novosti</title><h1>Novosti iz Gredica</h1></html>',
                        }),
                );

                await page.goto('/o-nama');
                await expect(page.locator('html')).toHaveAttribute(
                    'data-public-environment',
                    'on',
                );
                if (surface === 'header' && width < 768) {
                    await page
                        .getByRole('button', { name: 'Otvori navigaciju' })
                        .click();
                }
                const container =
                    surface === 'footer'
                        ? page.locator('footer')
                        : width < 768
                          ? page.getByRole('navigation', {
                                name: 'Glavna navigacija',
                            })
                          : page.locator('header');
                const news = container.getByRole('link', {
                    name: 'Novosti',
                    exact: true,
                });
                await expect(news).toHaveAttribute('href', '/novosti');
                await news.hover();
                // Allow the viewport/hover prefetch scheduler to run after hydration.
                await page.waitForTimeout(750);
                expect(newsRequests).toHaveLength(0);

                const responsePromise = page.waitForResponse(
                    (response) =>
                        new URL(response.url()).pathname === '/novosti' &&
                        response.request().isNavigationRequest(),
                );
                if (surface === 'header' && width >= 768) {
                    await news.focus();
                    await news.press('Enter');
                } else {
                    await news.click();
                }
                const response = await responsePromise;
                expect(response.status()).toBe(200);
                await expect(
                    page.getByRole('heading', { name: 'Novosti iz Gredica' }),
                ).toBeVisible();
                expect(newsRequests).toHaveLength(1);
                expect(newsRequests[0].resourceType()).toBe('document');
                expect(newsRequests[0].headers().rsc).toBeUndefined();
                expect(
                    newsRequests[0].headers()['next-router-prefetch'],
                ).toBeUndefined();
            });
        }
    }

    test('keeps client navigation for header links within WWW', async ({
        page,
    }) => {
        await page.goto('/o-nama');
        await expect(page.locator('html')).toHaveAttribute(
            'data-public-environment',
            'on',
        );
        await page.evaluate(() => {
            document.documentElement.dataset.navigationProbe = 'same-document';
        });
        const documentRequests: Request[] = [];
        page.on('request', (request) => {
            if (request.isNavigationRequest()) documentRequests.push(request);
        });

        await page
            .locator('header')
            .getByRole('link', { name: 'Česta pitanja', exact: true })
            .click();

        await expect(page).toHaveURL(/\/cesta-pitanja$/u);
        await expect(page.locator('html')).toHaveAttribute(
            'data-navigation-probe',
            'same-document',
        );
        expect(documentRequests).toHaveLength(0);
    });
});
