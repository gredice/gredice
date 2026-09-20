import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
    formatSitemapInventoryMarkdown,
    resolveSitemapRouteFamily,
    summarizeSitemapInventory,
} from '../lib/sitemap/sitemapInventory.ts';
import {
    excludedSitemapRoutes,
    isExcludedSitemapPath,
    mergeSitemapEntries,
    normalizeSitemapPath,
    toSitemapLastmod,
} from '../lib/sitemap/sitemapPolicy.ts';
import {
    appRouterHubPaths,
    collectSitemapLastmodIndex,
    collectSitemapSourceEntries,
    collectSitemapSourcePaths,
    defaultGardenBlockNameCount,
    isIndexableCmsPage,
    isIndexablePublicGarden,
    newsHubPaths,
    sitemapHubPaths,
    sourceCmsPagePaths,
} from '../lib/sitemap/sitemapSourcePaths.ts';
import {
    COMPANION_PLANTING_PATH,
    QUALITY_HARVEST_SAFETY_PATH,
} from '../src/publicPagePaths.ts';

const publishedAt = new Date('2026-08-10T10:00:00Z');
const updatedAt = new Date('2026-09-01T09:30:00Z');

function sourceEntries(
    overrides: Partial<Parameters<typeof collectSitemapSourceEntries>[0]> = {},
) {
    return collectSitemapSourceEntries({
        cmsPages: [],
        publicGardens: [],
        ...overrides,
    });
}

test('every public hub is published exactly once', () => {
    const paths = collectSitemapSourcePaths({
        cmsPages: [
            {
                // The hub is also a CMS record; it must not be published twice.
                slug: 'biljni-susjedi',
                state: 'published',
                publishedAt,
                noIndex: false,
            },
        ],
        publicGardens: [],
    });

    for (const hubPath of sitemapHubPaths) {
        assert.equal(
            paths.filter((path) => path === hubPath).length,
            1,
            hubPath,
        );
    }

    assert.ok(paths.includes('/biljke'));
    assert.ok(paths.includes('/blokovi'));
    assert.ok(paths.includes('/vrtovi'));
    assert.equal(new Set(paths).size, paths.length);
});

test('public hubs resolve to a rendered route', () => {
    for (const hubPath of appRouterHubPaths) {
        const routeFile = new URL(
            `../app${hubPath === '/' ? '' : hubPath}/page.tsx`,
            import.meta.url,
        );
        assert.ok(existsSync(routeFile), hubPath);
    }

    assert.ok(
        existsSync(new URL('../../news/app/page.tsx', import.meta.url)),
        newsHubPaths[0],
    );
    assert.ok(
        existsSync(
            new URL('../../news/app/sto-je-novo/page.tsx', import.meta.url),
        ),
        newsHubPaths[1],
    );
    assert.deepEqual(
        [...sourceCmsPagePaths],
        [COMPANION_PLANTING_PATH, QUALITY_HARVEST_SAFETY_PATH],
    );
});

test('utility files, tracking and filter permutations stay out of the sitemap', () => {
    const excluded = [
        '/icon.png',
        '/icon.svg',
        '/apple-icon.png',
        '/favicon.ico',
        '/manifest.json',
        '/opengraph-image',
        '/biljke/rajcica/opengraph-image',
        '/llms.txt',
        '/llms-full.txt',
        '/.well-known/security.txt',
        '/api/og/public',
        '/api/draft/disable',
        '/development',
        '/development/deployments',
        '/trag/abc123',
        '/prijava/google-prijava/povratak',
        '/cjenik/cjenik.csv',
        '/cjenik/preuzimanje/12',
        '/pretraga',
        '/blokovi/biljke/generator',
        '/pozdrav/ana',
        '/biljke?pretraga=rajcica',
        '/biljke?pregled=kalendar',
    ];

    for (const path of excluded) {
        assert.equal(isExcludedSitemapPath(path), true, path);
    }

    for (const path of ['/', '/biljke', '/blokovi/pijesak', '/vrtovi/42']) {
        assert.equal(isExcludedSitemapPath(path), false, path);
    }

    assert.equal(
        mergeSitemapEntries([
            { path: '/biljke' },
            { path: '/icon.png' },
            { path: '/biljke?pretraga=rajcica' },
        ]).length,
        1,
    );
});

test('sitemap paths are normalised before they are compared', () => {
    assert.equal(normalizeSitemapPath('/biljke/'), '/biljke');
    assert.equal(normalizeSitemapPath('//biljke//rajcica'), '/biljke/rajcica');
    assert.equal(normalizeSitemapPath('/'), '/');
    assert.equal(
        normalizeSitemapPath('/biljke/rajčica'),
        '/biljke/raj%C4%8Dica',
    );
    assert.equal(
        normalizeSitemapPath('/biljke/raj%C4%8Dica'),
        '/biljke/raj%C4%8Dica',
    );

    const merged = mergeSitemapEntries([
        { path: '/biljke/' },
        { path: '/biljke' },
    ]);
    assert.deepEqual(merged, [{ path: '/biljke' }]);
});

test('only published, indexable and self-canonical CMS pages are published', () => {
    const paths = collectSitemapSourcePaths({
        cmsPages: [
            {
                slug: 'objavljeno',
                state: 'published',
                publishedAt,
                noIndex: false,
            },
            {
                slug: 'skica',
                state: 'draft',
                publishedAt: null,
                noIndex: false,
            },
            {
                slug: 'u-pregledu',
                state: 'in-review',
                publishedAt,
                noIndex: false,
            },
            {
                slug: 'bez-indeksa',
                state: 'published',
                publishedAt,
                noIndex: true,
            },
            {
                slug: 'bez-datuma',
                state: 'published',
                publishedAt: null,
                noIndex: false,
            },
            {
                slug: 'kopija',
                state: 'published',
                publishedAt,
                noIndex: false,
                canonicalPath: '/objavljeno',
            },
            {
                slug: 'novosti/nova-objava',
                state: 'published',
                publishedAt,
                noIndex: false,
            },
        ],
        publicGardens: [],
    });

    assert.ok(paths.includes('/objavljeno'));
    assert.ok(paths.includes('/novosti/nova-objava'));
    for (const path of [
        '/skica',
        '/u-pregledu',
        '/bez-indeksa',
        '/bez-datuma',
        '/kopija',
    ]) {
        assert.equal(paths.includes(path), false, path);
    }

    assert.equal(
        isIndexableCmsPage({
            slug: 'objavljeno',
            state: 'published',
            publishedAt,
            noIndex: false,
            canonicalPath: '/objavljeno',
        }),
        true,
    );
});

test('public gardens are kept unless the page is still the starter garden', () => {
    const starterGarden = {
        id: 1,
        updatedAt,
        distinctBlockNameCount: defaultGardenBlockNameCount,
        activePlantingCount: 0,
    };
    const decoratedGarden = {
        id: 2,
        updatedAt,
        distinctBlockNameCount: defaultGardenBlockNameCount + 1,
        activePlantingCount: 0,
    };
    const plantedGarden = {
        id: 3,
        updatedAt,
        distinctBlockNameCount: defaultGardenBlockNameCount,
        activePlantingCount: 4,
    };
    const emptyGarden = { id: 4, updatedAt };

    assert.equal(isIndexablePublicGarden(starterGarden), false);
    assert.equal(isIndexablePublicGarden(decoratedGarden), true);
    assert.equal(isIndexablePublicGarden(plantedGarden), true);
    assert.equal(isIndexablePublicGarden(emptyGarden), false);

    const paths = collectSitemapSourcePaths({
        cmsPages: [],
        publicGardens: [
            starterGarden,
            decoratedGarden,
            plantedGarden,
            emptyGarden,
        ],
    });

    assert.ok(paths.includes('/vrtovi/2'));
    assert.ok(paths.includes('/vrtovi/3'));
    assert.equal(paths.includes('/vrtovi/1'), false);
    assert.equal(paths.includes('/vrtovi/4'), false);
});

test('lastmod carries content timestamps and is omitted when unavailable', () => {
    const entries = sourceEntries({
        cmsPages: [
            {
                slug: 'uredeno',
                state: 'published',
                publishedAt,
                updatedAt,
                noIndex: false,
            },
            {
                slug: 'samo-objavljeno',
                state: 'published',
                publishedAt,
                noIndex: false,
            },
            {
                slug: 'neispravan-datum',
                state: 'published',
                publishedAt,
                updatedAt: 'not-a-date',
                noIndex: false,
            },
        ],
        publicGardens: [
            {
                id: 7,
                updatedAt,
                distinctBlockNameCount: 6,
                activePlantingCount: 2,
            },
        ],
    });
    const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));

    assert.equal(entryByPath.get('/uredeno')?.lastmod, updatedAt.toISOString());
    assert.equal(
        entryByPath.get('/samo-objavljeno')?.lastmod,
        publishedAt.toISOString(),
    );
    assert.equal(
        entryByPath.get('/neispravan-datum')?.lastmod,
        publishedAt.toISOString(),
    );
    assert.equal(
        entryByPath.get('/vrtovi/7')?.lastmod,
        updatedAt.toISOString(),
    );

    // Static hubs carry no reliable content timestamp, so they report none.
    assert.equal(entryByPath.get('/')?.lastmod, undefined);
    assert.equal(entryByPath.get('/kontakt')?.lastmod, undefined);
    assert.equal(toSitemapLastmod('not-a-date'), undefined);
    assert.equal(toSitemapLastmod(null), undefined);
});

test('the lastmod index covers prerendered catalogue pages', () => {
    const index = collectSitemapLastmodIndex({
        sourceEntries: [
            { path: '/vrtovi/7', lastmod: updatedAt.toISOString() },
        ],
        directoryEntries: [
            { path: '/blokovi/pijesak', updatedAt: publishedAt },
            { path: '/blokovi/pijesak/', updatedAt },
            { path: '/biljke/rajcica' },
            { path: '/api/og/public', updatedAt },
        ],
    });

    assert.equal(index.get('/vrtovi/7'), updatedAt.toISOString());
    // The newest known timestamp wins for the same normalised path.
    assert.equal(index.get('/blokovi/pijesak'), updatedAt.toISOString());
    assert.equal(index.has('/biljke/rajcica'), false);
    assert.equal(index.has('/api/og/public'), false);
});

test('the generator never reports build time and keeps one policy for both sources', () => {
    const configSource = readFileSync(
        new URL('../next-sitemap.config.ts', import.meta.url),
        'utf8',
    );

    assert.match(configSource, /autoLastmod: false/u);
    assert.doesNotMatch(configSource, /new Date\(\)/u);
    assert.match(configSource, /exclude: \[\.\.\.excludedSitemapRoutes\]/u);
    assert.match(configSource, /isExcludedSitemapPath\(loc\)/u);
    assert.match(configSource, /getSitemapLastmodIndex/u);
});

test('pages dropped from the sitemap stay crawlable', () => {
    const configSource = readFileSync(
        new URL('../next-sitemap.config.ts', import.meta.url),
        'utf8',
    );
    const disallowMatches = configSource.match(/disallow: \[[^\]]*\]/gu) ?? [];

    assert.ok(disallowMatches.length > 0);
    for (const disallow of disallowMatches) {
        assert.equal(disallow, "disallow: ['/trag/']");
    }

    const generatorSource = readFileSync(
        new URL('../app/blokovi/biljke/generator/page.tsx', import.meta.url),
        'utf8',
    );
    assert.match(generatorSource, /index: false/u);
    assert.match(generatorSource, /follow: true/u);
});

test('the excluded route policy is the one handed to next-sitemap', () => {
    for (const pattern of excludedSitemapRoutes) {
        assert.ok(pattern.startsWith('/'), pattern);
    }

    assert.equal(
        new Set(excludedSitemapRoutes).size,
        excludedSitemapRoutes.length,
    );
    const patterns: readonly string[] = excludedSitemapRoutes;
    assert.ok(patterns.includes('/icon.png'));
    assert.ok(patterns.includes('/manifest.json'));
    // Public gardens are now filtered per page instead of by a blanket glob.
    assert.equal(patterns.includes('/vrtovi'), false);
    assert.equal(patterns.includes('/vrtovi/*'), false);
});

test('the inventory groups URLs by route family', () => {
    assert.equal(resolveSitemapRouteFamily('/').id, 'home');
    assert.equal(resolveSitemapRouteFamily('/biljke/rajcica').id, 'plants');
    assert.equal(resolveSitemapRouteFamily('/blokovi/pijesak').id, 'blocks');
    assert.equal(resolveSitemapRouteFamily('/vrtovi/42').id, 'gardens');
    assert.equal(resolveSitemapRouteFamily('/novosti/objava').id, 'news');
    assert.equal(resolveSitemapRouteFamily('/o-nama').id, 'content');

    const rows = summarizeSitemapInventory([
        { path: '/', lastmod: updatedAt.toISOString(), status: 200 },
        {
            path: '/vrtovi/42',
            status: 200,
            indexable: true,
            canonical: 'https://www.gredice.com/vrtovi/42',
            hasContent: true,
            impressions: 12,
        },
        {
            path: '/vrtovi/43',
            status: 404,
            indexable: false,
            canonical: 'https://www.gredice.com/vrtovi',
            hasContent: false,
            impressions: 3,
        },
    ]);
    const gardens = rows.find((row) => row.family === 'gardens');

    assert.equal(rows.length, 2);
    assert.equal(gardens?.total, 2);
    assert.equal(gardens?.okStatus, 1);
    assert.equal(gardens?.otherStatus, 1);
    assert.equal(gardens?.noIndex, 1);
    assert.equal(gardens?.canonicalMismatch, 1);
    assert.equal(gardens?.emptyContent, 1);
    assert.equal(gardens?.impressions, 15);
    assert.match(formatSitemapInventoryMarkdown(rows), /Javni vrtovi/u);
});
