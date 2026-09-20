import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
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

const twelveHourCatalogueRevalidationPages = [
    '../app/biljke/[alias]/page.tsx',
    '../app/biljke/[alias]/sorte/[sortAlias]/page.tsx',
    '../app/radnje/page.tsx',
    '../app/radnje/[alias]/page.tsx',
    '../app/blokovi/page.tsx',
    '../app/blokovi/[alias]/page.tsx',
    '../app/blokovi/biljke/page.tsx',
    '../app/blokovi/biljke/[alias]/page.tsx',
    '../app/blokovi/ljubimci/page.tsx',
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

test('catalogue pages declare a twelve-hour revalidation interval', () => {
    for (const relativePath of twelveHourCatalogueRevalidationPages) {
        const source = readFileSync(
            new URL(relativePath, import.meta.url),
            'utf8',
        );
        assert.match(source, /export const revalidate = 43200;/u, relativePath);
    }

    const nextConfig = readFileSync(
        new URL('../next.config.ts', import.meta.url),
        'utf8',
    );
    assert.match(nextConfig, /expireTime: 54000,/u);
});

test('plant detail pages remain compatible with static generation', () => {
    const source = readFileSync(
        new URL('../app/biljke/[alias]/page.tsx', import.meta.url),
        'utf8',
    );

    assert.match(source, /export async function generateStaticParams\(\)/u);
    assert.match(source, /export const revalidate = 43200;/u);
    assert.doesNotMatch(
        source,
        /flags\/next|recipesFlag|\bheaders\(|\bcookies\(|force-dynamic/u,
    );
});

test('sitemap generation reads source data without HTTP fallbacks', () => {
    const sitemapRoute = readFileSync(
        new URL('../app/sitemap.ts', import.meta.url),
        'utf8',
    );
    const sourceLoader = readFileSync(
        new URL('../lib/sitemap/getSitemapSourcePaths.ts', import.meta.url),
        'utf8',
    );

    assert.match(sitemapRoute, /getSitemapEntries/u);
    assert.doesNotMatch(sitemapRoute, httpDataSourcePattern);
    assert.match(sourceLoader, /getCmsPages/u);
    assert.match(sourceLoader, /getPublicGardenSitemapSources/u);
    assert.match(sourceLoader, /getSeedsData/u);
    assert.match(sourceLoader, /getSeedBrandsData/u);
    assert.doesNotMatch(sourceLoader, httpDataSourcePattern);
});

test('the sitemap is a Next.js route, not a generated file', () => {
    const packageJson = JSON.parse(
        readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    );
    const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };

    assert.equal('next-sitemap' in dependencies, false);
    assert.equal('postbuild' in packageJson.scripts, false);
    assert.equal(
        existsSync(new URL('../next-sitemap.config.ts', import.meta.url)),
        false,
    );
    assert.ok(existsSync(new URL('../app/sitemap.ts', import.meta.url)));
    assert.ok(existsSync(new URL('../app/robots.ts', import.meta.url)));

    // The previously submitted sitemap URL must not start returning 404.
    const nextConfig = readFileSync(
        new URL('../next.config.ts', import.meta.url),
        'utf8',
    );
    assert.match(nextConfig, /source: '\/sitemap-0\.xml'/u);
    assert.match(nextConfig, /destination: '\/sitemap\.xml'/u);
});

test('private utility routes declare no-index metadata', () => {
    const routePaths = [
        '../app/development/page.tsx',
        '../app/prijava/facebook-prijava/povratak/page.tsx',
        '../app/prijava/google-prijava/povratak/page.tsx',
    ];

    for (const routePath of routePaths) {
        const source = readFileSync(
            new URL(routePath, import.meta.url),
            'utf8',
        );
        assert.match(source, /index: false/u, routePath);
        assert.match(source, /follow: false/u, routePath);
    }
});

test('well-known llms discovery path redirects to the canonical file', () => {
    const nextConfig = readFileSync(
        new URL('../next.config.ts', import.meta.url),
        'utf8',
    );

    assert.match(nextConfig, /source: '\/\.well-known\/llms\.txt'/u);
    assert.match(nextConfig, /destination: '\/llms\.txt'/u);
    assert.match(nextConfig, /permanent: true/u);
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

test('public Outlet cards enter the selected offer in the 3D garden', () => {
    const outletDataSource = readFileSync(
        new URL('../app/outlet/outletData.ts', import.meta.url),
        'utf8',
    );
    const outletCardSource = readFileSync(
        new URL('../app/outlet/OutletOfferCard.tsx', import.meta.url),
        'utf8',
    );

    assert.match(
        outletDataSource,
        /https:\/\/vrt\.gredice\.com\/outlet\?ponuda=/u,
    );
    assert.match(outletCardSource, /Razgledaj u 3D vrtu/u);
});
