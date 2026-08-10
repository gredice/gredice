import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { collectSitemapSourcePaths } from '../lib/sitemap/sitemapSourcePaths.ts';
import { canonicalLegacyNewsPathname } from '../src/newsPaths.ts';

const staticDataLoaders = [
    '../lib/blocks/getBlocksData.ts',
    '../lib/getHqLocationsData.ts',
    '../lib/occasions/getOccasionsData.ts',
    '../lib/plants/getFaqData.ts',
    '../lib/plants/getOperationsData.ts',
    '../lib/plants/getPlantHealthIssuesData.ts',
    '../lib/plants/getPlantSortsData.ts',
    '../lib/plants/getPlantsData.ts',
    '../lib/seeds/getSeedBrandsData.ts',
    '../lib/seeds/getSeedsData.ts',
    '../lib/sunflowerPackages.ts',
] as const;

const httpDataSourcePattern =
    /\bdirectoriesClient\b|\bclientPublic\b|\bgetServerGrediceApiOrigin\b|\bfetch\s*\(/u;

test('static page data loaders do not call the public API', () => {
    for (const relativePath of staticDataLoaders) {
        const source = readFileSync(
            new URL(relativePath, import.meta.url),
            'utf8',
        );
        assert.doesNotMatch(source, httpDataSourcePattern, relativePath);
    }
});

test('sitemap generation reads source data without HTTP fallbacks', () => {
    const configSource = readFileSync(
        new URL('../next-sitemap.config.ts', import.meta.url),
        'utf8',
    );
    const sourceLoader = readFileSync(
        new URL('../lib/sitemap/getSitemapSourcePaths.ts', import.meta.url),
        'utf8',
    );

    assert.match(configSource, /getSitemapSourcePaths/u);
    assert.doesNotMatch(configSource, httpDataSourcePattern);
    assert.match(sourceLoader, /getCmsPages/u);
    assert.match(sourceLoader, /getPublicGardens/u);
    assert.match(sourceLoader, /getDirectoryEntitiesData\('seed'\)/u);
    assert.match(sourceLoader, /getDirectoryEntitiesData\('brand'\)/u);
    assert.doesNotMatch(sourceLoader, httpDataSourcePattern);
});

test('sitemap source paths keep only public CMS and catalogue records', () => {
    const paths = collectSitemapSourcePaths({
        cmsPages: [
            {
                slug: 'objavljeno',
                state: 'published',
                publishedAt: new Date('2026-08-10T00:00:00Z'),
                noIndex: false,
            },
            {
                slug: 'bez-indeksa',
                state: 'published',
                publishedAt: new Date('2026-08-10T00:00:00Z'),
                noIndex: true,
            },
            {
                slug: 'bez-datuma',
                state: 'published',
                publishedAt: null,
                noIndex: false,
            },
        ],
        publicGardens: [{ id: 42 }],
        seeds: [{ slug: 'sjeme-1' }, {}],
        brands: [{ slug: 'brend-1' }, { slug: null }],
    });

    assert.ok(paths.includes('/objavljeno'));
    assert.ok(paths.includes('/vrtovi/42'));
    assert.ok(paths.includes('/sjeme/sjeme-1'));
    assert.ok(paths.includes('/sjeme/brend/brend-1'));
    assert.ok(paths.includes('/biljni-susjedi'));
    assert.ok(paths.includes('/novosti'));
    assert.equal(paths.includes('/bez-indeksa'), false);
    assert.equal(paths.includes('/bez-datuma'), false);
});

test('legacy changelog paths redirect below the canonical news base path', () => {
    assert.equal(
        canonicalLegacyNewsPathname('/sto-je-novo'),
        '/novosti/sto-je-novo',
    );
    assert.equal(
        canonicalLegacyNewsPathname('/sto-je-novo/objava'),
        '/novosti/sto-je-novo/objava',
    );
    assert.equal(canonicalLegacyNewsPathname('/sto-je-novosti'), null);
    assert.equal(
        canonicalLegacyNewsPathname('/novosti/sto-je-novo/objava'),
        null,
    );
});
