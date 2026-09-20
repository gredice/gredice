import {
    isExcludedSitemapPath,
    mergeSitemapEntries,
    type SitemapEntry,
    sitemapPathKey,
    toSitemapLastmod,
} from './sitemapPolicy.ts';

export {
    canonicalQuerySitemapPaths,
    excludedSitemapRoutes,
    isExcludedSitemapPath,
    normalizeSitemapPath,
    type SitemapEntry,
    sitemapPathKey,
    toSitemapLastmod,
} from './sitemapPolicy.ts';

/**
 * Public hubs rendered by `apps/www`. They are listed explicitly because a hub
 * that reads `searchParams` (or opts into `force-dynamic`) is never part of the
 * build output `next-sitemap` scans, which is how `/biljke` went missing.
 */
export const appRouterHubPaths = [
    '/',
    '/biljke',
    '/blokovi',
    '/blokovi/biljke',
    '/blokovi/ljubimci',
    '/bolesti',
    '/cesta-pitanja',
    '/cjenik',
    '/dostava',
    '/dostava/termini',
    '/kontakt',
    '/korisnici',
    '/legalno',
    '/legalno/licenca',
    '/legalno/natjecaji',
    '/legalno/politika-kolacica',
    '/legalno/politika-privatnosti',
    '/legalno/trece-strane',
    '/legalno/tvrtka',
    '/legalno/uvjeti-koristenja',
    '/mcp',
    '/o-nama',
    '/outlet',
    '/podignuta-gredica',
    '/povrati-i-povrat-novca',
    '/pozadine',
    '/preporuke',
    '/radnje',
    '/sjeme',
    '/sjeme/brendovi',
    '/sjetva',
    '/stetnici',
    '/suncokreti',
    '/vodic-za-prvu-gredicu',
    '/vrtovi',
] as const;

/** Hubs served from `apps/news` through the `/novosti` rewrite. */
export const newsHubPaths = ['/novosti', '/novosti/sto-je-novo'] as const;

/**
 * CMS-backed pages that also ship a local source copy, so they are published
 * even when the directory API has not served them yet.
 */
export const sourceCmsPagePaths = [
    '/biljni-susjedi',
    '/kvaliteta-i-sigurnost-uroda',
] as const;

/** Every hub that must be present in the sitemap exactly once. */
export const sitemapHubPaths = [
    ...appRouterHubPaths,
    ...newsHubPaths,
    ...sourceCmsPagePaths,
] as const;

/**
 * A freshly created garden holds a grass grid and one empty raised bed, so two
 * distinct block names still mean "nothing has been built here yet". Such
 * gardens are near-identical to each other and carry no page-level content;
 * anything above that threshold, or any active planting, is a real showcase.
 */
export const defaultGardenBlockNameCount = 2;

export type CmsSitemapPage = {
    slug: string;
    state: string;
    publishedAt: Date | string | null;
    updatedAt?: Date | string | null;
    noIndex: boolean;
    canonicalPath?: string | null;
};

export type PublicGardenSitemapSource = {
    id: number;
    updatedAt?: Date | string | null;
    /** Number of distinct block names placed in the garden. */
    distinctBlockNameCount?: number;
    /** Number of active, non-deleted plantings across the garden. */
    activePlantingCount?: number;
};

export type DirectorySitemapSource = {
    path: string;
    updatedAt?: Date | string | null;
};

function canonicalCmsPagePath(page: CmsSitemapPage) {
    return `/${page.slug}`;
}

/**
 * CMS eligibility mirrors what `apps/www` renders: published, dated, indexable
 * and canonical to itself. A page pointing its canonical elsewhere stays
 * crawlable but must not be advertised as a canonical URL.
 */
export function isIndexableCmsPage(page: CmsSitemapPage) {
    if (page.state !== 'published' || !page.publishedAt || page.noIndex) {
        return false;
    }

    const canonicalPath = page.canonicalPath?.trim();
    if (canonicalPath && canonicalPath !== canonicalCmsPagePath(page)) {
        return false;
    }

    return true;
}

/**
 * Public gardens are kept unless the page would be empty: no blanket removal,
 * only the documented "still the starter garden" rule.
 */
export function isIndexablePublicGarden(garden: PublicGardenSitemapSource) {
    if ((garden.activePlantingCount ?? 0) > 0) {
        return true;
    }

    return (garden.distinctBlockNameCount ?? 0) > defaultGardenBlockNameCount;
}

export function publicGardenSitemapPath(garden: PublicGardenSitemapSource) {
    return `/vrtovi/${garden.id.toString()}`;
}

/**
 * Build the sitemap entries that cannot be discovered from the build output:
 * dynamic hubs, CMS pages and public gardens. Catalogue detail pages are
 * prerendered, so the build output already lists them; they only contribute
 * timestamps through `collectSitemapLastmodIndex`.
 */
export function collectSitemapSourceEntries({
    cmsPages,
    publicGardens,
}: {
    cmsPages: ReadonlyArray<CmsSitemapPage>;
    publicGardens: ReadonlyArray<PublicGardenSitemapSource>;
}): SitemapEntry[] {
    const entries: SitemapEntry[] = sitemapHubPaths.map((path) => ({ path }));

    for (const page of cmsPages) {
        if (!isIndexableCmsPage(page)) {
            continue;
        }

        entries.push({
            path: canonicalCmsPagePath(page),
            lastmod:
                toSitemapLastmod(page.updatedAt) ??
                toSitemapLastmod(page.publishedAt),
        });
    }

    for (const garden of publicGardens) {
        if (!isIndexablePublicGarden(garden)) {
            continue;
        }

        entries.push({
            path: publicGardenSitemapPath(garden),
            lastmod: toSitemapLastmod(garden.updatedAt),
        });
    }

    return mergeSitemapEntries(entries);
}

/** Paths only, for callers that do not carry timestamps. */
export function collectSitemapSourcePaths(
    sources: Parameters<typeof collectSitemapSourceEntries>[0],
) {
    return collectSitemapSourceEntries(sources).map((entry) => entry.path);
}

/**
 * `path -> lastmod` lookup used while transforming every sitemap URL, including
 * the prerendered catalogue pages `next-sitemap` discovers from the build
 * output. Paths without a reliable timestamp stay out of the index so their
 * `lastmod` is omitted rather than reported as build time.
 */
export function collectSitemapLastmodIndex({
    sourceEntries = [],
    directoryEntries = [],
}: {
    sourceEntries?: ReadonlyArray<SitemapEntry>;
    directoryEntries?: ReadonlyArray<DirectorySitemapSource>;
}): Map<string, string> {
    const index = new Map<string, string>();
    const candidates: SitemapEntry[] = [
        ...sourceEntries,
        ...directoryEntries.map((entry) => ({
            path: entry.path,
            lastmod: toSitemapLastmod(entry.updatedAt),
        })),
    ];

    for (const entry of candidates) {
        const lastmod = toSitemapLastmod(entry.lastmod);
        if (!lastmod || isExcludedSitemapPath(entry.path)) {
            continue;
        }

        const key = sitemapPathKey(entry.path);
        const existing = index.get(key);
        if (!existing || existing < lastmod) {
            index.set(key, lastmod);
        }
    }

    return index;
}
