import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { validateSerializedStructuredData } from '../components/shared/seo/structuredDataValidation';
import { expect, test } from './fixtures';

const publicSiteOrigin = 'https://www.gredice.com';
const homepageOpenGraphTitle = 'Gredice - vrt po tvom';
const externalRewritePrefixes = ['/novosti'];
const publicOgExactPaths = new Set([
    '/',
    '/biljke',
    '/blokovi',
    '/blokovi/biljke',
    '/bolesti',
    '/cesta-pitanja',
    '/cjenik',
    '/dostava',
    '/dostava-povrca-zagreb',
    '/dostava/termini',
    '/kontakt',
    '/mcp',
    '/o-nama',
    '/outlet',
    '/podignuta-gredica',
    '/povrati-i-povrat-novca',
    '/preporuke',
    '/radnje',
    '/sjeme',
    '/sjeme/brendovi',
    '/sjetva',
    '/stetnici',
    '/suncokreti',
    '/vodic-za-prvu-gredicu',
    '/vrtovi',
]);

function isExternalRewriteRoute(pathname: string) {
    return externalRewritePrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

function shouldUseEntityCover(pathname: string) {
    if (pathname.startsWith('/biljke/')) {
        return true;
    }

    if (pathname.startsWith('/radnje/')) {
        return true;
    }

    return (
        pathname.startsWith('/blokovi/') &&
        pathname !== '/blokovi/biljke' &&
        pathname !== '/blokovi/biljke/generator'
    );
}

function dynamicCoverFamily(pathname: string) {
    if (/^\/biljke\/[^/]+\/sorte\/[^/]+$/u.test(pathname)) {
        return 'plant-sort';
    }

    if (/^\/biljke\/[^/]+$/u.test(pathname)) {
        return 'plant';
    }

    if (/^\/radnje\/[^/]+$/u.test(pathname)) {
        return 'operation';
    }

    if (/^\/blokovi\/biljke\/[^/]+$/u.test(pathname)) {
        return pathname.endsWith('/generator') ? null : 'block-plant';
    }

    if (/^\/blokovi\/[^/]+$/u.test(pathname)) {
        return pathname === '/blokovi/biljke' ? null : 'block';
    }

    return null;
}

function representativeDynamicCoverPaths(pages: string[]) {
    const representativeByFamily = new Map<string, string>();

    for (const page of pages) {
        const pathname = new URL(page, publicSiteOrigin).pathname;
        const family = dynamicCoverFamily(pathname);
        if (family && !representativeByFamily.has(family)) {
            representativeByFamily.set(family, pathname);
        }
    }

    return new Set(representativeByFamily.values());
}

function requiresPublicOgCoverage(url: string) {
    const { pathname } = new URL(url, publicSiteOrigin);

    if (publicOgExactPaths.has(pathname) || pathname.startsWith('/legalno')) {
        return true;
    }

    if (
        pathname.startsWith('/biljke/') ||
        pathname.startsWith('/bolesti/') ||
        pathname.startsWith('/radnje/') ||
        pathname.startsWith('/stetnici/')
    ) {
        return true;
    }

    if (pathname.startsWith('/blokovi/biljke/')) {
        return pathname !== '/blokovi/biljke/generator';
    }

    return pathname.startsWith('/blokovi/') && pathname !== '/blokovi/biljke';
}

test.describe('public SEO metadata', () => {
    const pages = JSON.parse(
        readFileSync('./tests/sitemap-pages.json', 'utf8'),
    ) as string[];
    const representativeCoverPaths = representativeDynamicCoverPaths(pages);

    test('delivery schedule renders meaningful dates without placeholders in initial HTML', async ({
        page,
    }) => {
        const response = await page.request.get('/dostava/termini');
        const html = await response.text();

        expect(response.ok()).toBe(true);
        expect(html).toContain('Termini dostave');
        expect(html).toContain('sljedećih mjesec dana');
        expect(html).toMatch(/dateTime/u);
        expect(html).toMatch(/\d{2}:\d{2}/u);
        expect(html).not.toMatch(/>\.\.\.<\/span>/u);

        await page.goto('/dostava/termini', {
            waitUntil: 'domcontentloaded',
        });
        await expect(page.locator('time').first()).toBeAttached();
    });

    test('Zagreb delivery landing is discoverable and links to its supporting cluster', async ({
        page,
    }) => {
        const landingPath = '/dostava-povrca-zagreb';
        const contextualSources = [
            '/',
            '/dostava',
            '/podignuta-gredica',
            '/biljke',
        ];

        for (const source of contextualSources) {
            await page.goto(source, { waitUntil: 'domcontentloaded' });
            await expect(
                page.locator(`main a[href="${landingPath}"]`).first(),
                `${source} contextual link`,
            ).toBeAttached();
        }

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(
            page.locator(`footer a[href="${landingPath}"]`).first(),
            'footer discovery link',
        ).toBeAttached();

        await page.goto(landingPath, { waitUntil: 'domcontentloaded' });
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: 'Dostava svježeg povrća u Zagrebu',
            }),
        ).toHaveCount(1);
        await expect(
            page.locator('main a[href="/dostava"]').first(),
        ).toBeAttached();

        for (const articlePath of [
            '/novosti/dostava-povrca-u-zagrebu-kako-funkcioniraju-gredice',
            '/novosti/povrtna-kosarica-ili-vlastita-gredica',
            '/novosti/koliko-kosta-dostava-povrca-u-zagrebu',
        ]) {
            await expect(
                page.locator(`main a[href="${articlePath}"]`).first(),
                `${articlePath} reciprocal link`,
            ).toBeAttached();
        }
    });

    test('legacy corner-stairs path redirects to canonical metadata', async ({
        page,
    }) => {
        const redirect = await page.request.get('/blokovi/kamene-polustube', {
            maxRedirects: 0,
        });
        expect(redirect.status()).toBe(308);
        expect(redirect.headers().location).toBe('/blokovi/kutne-kamene-stube');

        await page.goto('/blokovi/kamene-polustube', {
            waitUntil: 'domcontentloaded',
        });

        const canonicalUrl =
            'https://www.gredice.com/blokovi/kutne-kamene-stube';
        expect(new URL(page.url()).pathname).toBe(
            '/blokovi/kutne-kamene-stube',
        );
        await expect(page).toHaveTitle(/Kamene polustube|Kutne kamene stube/u);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            canonicalUrl,
        );
        await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
            'content',
            canonicalUrl,
        );
        await expect(
            page.locator('meta[property="og:description"]'),
        ).toHaveAttribute('content', /.+/u);
        await expect(
            page.locator('meta[property="og:image"]').first(),
        ).toHaveAttribute('content', /Block_Stone_Stairs_(Half|Corner)/u);
        await expect(
            page.locator('meta[name="twitter:image"]').first(),
        ).toHaveAttribute('content', /Block_Stone_Stairs_(Half|Corner)/u);
    });

    test('generated OG images survive a cache-miss image optimization', async ({
        page,
    }) => {
        // The fragment creates a fresh optimizer key without changing the static asset request.
        const optimizerCacheKey = encodeURIComponent(
            `/web-app-manifest-192x192.png#${randomUUID()}`,
        );
        const optimizedImage = await page.request.get(
            `/_next/image?url=${optimizerCacheKey}&w=3840&q=75`,
        );

        expect(optimizedImage.ok()).toBe(true);
        expect(optimizedImage.headers()['x-nextjs-cache']).toBe('MISS');

        await page.goto('/sjetva', { waitUntil: 'domcontentloaded' });

        const openGraphImageContent = await page
            .locator('meta[property="og:image"]')
            .first()
            .getAttribute('content');
        const openGraphImageUrl = new URL(openGraphImageContent ?? '');
        const openGraphImageResponse = await page.request.get(
            `${openGraphImageUrl.pathname}${openGraphImageUrl.search}`,
        );
        const openGraphImageBody = await openGraphImageResponse.body();

        expect(openGraphImageResponse.ok()).toBe(true);
        expect(openGraphImageResponse.headers()['content-type']).toContain(
            'image/png',
        );
        expect(openGraphImageBody.subarray(1, 4).toString()).toBe('PNG');
        expect(openGraphImageBody.readUInt32BE(16)).toBe(1200);
        expect(openGraphImageBody.readUInt32BE(20)).toBe(630);
    });

    test('framework static assets opt out of search indexing', async ({
        page,
    }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const assetUrl = await page
            .locator('script[src^="/_next/static/"]')
            .first()
            .getAttribute('src');

        expect(assetUrl).toBeTruthy();
        if (!assetUrl) {
            return;
        }

        const assetResponse = await page.request.get(assetUrl);

        expect(assetResponse.ok()).toBe(true);
        expect(assetResponse.headers()['x-robots-tag']).toBe('noindex');
    });

    for (const url of pages) {
        test(`page ${url} has valid SEO metadata`, async ({ page }) => {
            test.slow();
            const sitemapPathname = new URL(url, publicSiteOrigin).pathname;

            test.skip(
                isExternalRewriteRoute(sitemapPathname),
                'Route is rendered and tested by the separate News app.',
            );

            await page.goto(`${url}`, {
                waitUntil: 'domcontentloaded',
            });

            if (url !== '/') {
                const title = await page.title();
                expect(title).not.toBe('Gredice - vrt po tvom');
            }

            if (requiresPublicOgCoverage(url)) {
                const expectedPathname = new URL(page.url()).pathname;
                const expectedCanonicalUrl = new URL(
                    expectedPathname,
                    publicSiteOrigin,
                ).href;
                const canonical = page.locator('link[rel="canonical"]');
                const openGraphTitle = page.locator(
                    'meta[property="og:title"]',
                );
                const openGraphDescription = page.locator(
                    'meta[property="og:description"]',
                );
                const openGraphUrl = page.locator('meta[property="og:url"]');
                const openGraphImage = page
                    .locator('meta[property="og:image"]')
                    .first();
                const twitterTitle = page.locator('meta[name="twitter:title"]');
                const twitterDescription = page.locator(
                    'meta[name="twitter:description"]',
                );
                const twitterImage = page
                    .locator('meta[name="twitter:image"]')
                    .first();

                await expect(canonical).toHaveAttribute(
                    'href',
                    expectedCanonicalUrl,
                );
                await expect(openGraphTitle).toHaveAttribute('content', /.+/);
                await expect(openGraphDescription).toHaveAttribute(
                    'content',
                    /.+/,
                );
                await expect(openGraphUrl).toHaveAttribute(
                    'content',
                    expectedCanonicalUrl,
                );
                await expect(openGraphImage).toHaveAttribute('content', /.+/);
                await expect(
                    page.locator('meta[property="og:image:width"]').first(),
                ).toHaveAttribute('content', '1200');
                await expect(
                    page.locator('meta[property="og:image:height"]').first(),
                ).toHaveAttribute('content', '630');
                await expect(
                    page.locator('meta[property="og:image:alt"]').first(),
                ).toHaveAttribute('content', /.+/);
                await expect(
                    page.locator('meta[property="og:image:type"]').first(),
                ).toHaveAttribute('content', 'image/png');
                await expect(
                    page.locator('meta[property="og:type"]'),
                ).toHaveAttribute('content', 'website');
                await expect(
                    page.locator('meta[name="twitter:card"]'),
                ).toHaveAttribute('content', 'summary_large_image');
                await expect(twitterTitle).toHaveAttribute(
                    'content',
                    (await openGraphTitle.getAttribute('content')) ?? '',
                );
                await expect(twitterDescription).toHaveAttribute(
                    'content',
                    (await openGraphDescription.getAttribute('content')) ?? '',
                );
                await expect(twitterImage).toHaveAttribute('content', /.+/);
                await expect(
                    page.locator('meta[name="twitter:image:alt"]').first(),
                ).toHaveAttribute('content', /.+/);

                const openGraphTitleContent =
                    await openGraphTitle.getAttribute('content');
                const openGraphImageContent =
                    await openGraphImage.getAttribute('content');
                const twitterImageContent =
                    await twitterImage.getAttribute('content');

                if (expectedPathname !== '/') {
                    expect(openGraphTitleContent).not.toBe(
                        homepageOpenGraphTitle,
                    );
                    expect(twitterImageContent).toBe(openGraphImageContent);
                }

                if (shouldUseEntityCover(expectedPathname)) {
                    expect(
                        new URL(openGraphImageContent ?? '').searchParams.has(
                            'image',
                        ),
                    ).toBe(true);
                }

                if (
                    publicOgExactPaths.has(expectedPathname) ||
                    expectedPathname.startsWith('/legalno') ||
                    representativeCoverPaths.has(expectedPathname)
                ) {
                    const imageUrl = new URL(openGraphImageContent ?? '');
                    const imageResponse = await page.request.get(
                        `${imageUrl.pathname}${imageUrl.search}`,
                    );
                    const imageBody = await imageResponse.body();

                    expect(imageResponse.ok()).toBe(true);
                    expect(imageResponse.headers()['content-type']).toContain(
                        'image/png',
                    );
                    expect(imageBody.subarray(1, 4).toString()).toBe('PNG');
                    expect(imageBody.readUInt32BE(16)).toBe(1200);
                    expect(imageBody.readUInt32BE(20)).toBe(630);

                    if (representativeCoverPaths.has(expectedPathname)) {
                        const coverStats = await sharp(imageBody)
                            .extract({
                                left: 808,
                                top: 138,
                                width: 318,
                                height: 354,
                            })
                            .stats();
                        const maximumColorDeviation = Math.max(
                            ...coverStats.channels
                                .slice(0, 3)
                                .map((channel) => channel.stdev),
                        );

                        expect(maximumColorDeviation).toBeGreaterThan(3);
                    }
                }
            }

            const structuredDataScripts = await page
                .locator('script[type="application/ld+json"]')
                .allTextContents();

            structuredDataScripts.forEach((script, index) => {
                const issues = validateSerializedStructuredData(script);
                expect(
                    issues,
                    `Invalid structured data script ${index + 1} on ${url}: ${issues
                        .map((issue) => `${issue.path}: ${issue.message}`)
                        .join('; ')}`,
                ).toEqual([]);
            });
        });
    }
});
