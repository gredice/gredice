import {
    mergeSitemapEntries,
    type SitemapEntry,
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
    toSitemapUrl,
} from './sitemapPolicy.ts';

/**
 * Public hubs rendered by `apps/www`. Nothing crawls the route tree for us, so
 * every hub is listed here; `sitemapRouteCoverage.node.spec.ts` fails when a
 * public page in `app/` is neither listed nor excluded by policy.
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
 * How each dynamic route family reaches the sitemap. Nothing enumerates routes
 * for us any more, so every `[param]` route in `app/` is classified here and
 * `sitemapRouteCoverage.node.spec.ts` fails when a new one appears unclassified.
 */
export const dynamicRouteSitemapPolicy: Record<
    string,
    {
        source: 'cms' | 'directory' | 'gardens' | 'excluded' | 'not-published';
        reason: string;
    }
> = {
    '/[...slug]': {
        source: 'cms',
        reason: 'Published CMS pages, including /novosti articles.',
    },
    '/biljke/[alias]': {
        source: 'directory',
        reason: 'Plant catalogue entries.',
    },
    '/biljke/[alias]/sorte/[sortAlias]': {
        source: 'directory',
        reason: 'Plant sort entries.',
    },
    '/blokovi/[alias]': {
        source: 'directory',
        reason: 'Block entries; in-app items, kept indexable.',
    },
    '/blokovi/biljke/[alias]': {
        source: 'directory',
        reason: 'Plants with a procedural block model.',
    },
    '/bolesti/[alias]': {
        source: 'directory',
        reason: 'Plant disease guides.',
    },
    '/stetnici/[alias]': {
        source: 'directory',
        reason: 'Plant pest guides.',
    },
    '/radnje/[alias]': {
        source: 'directory',
        reason: 'Garden operation guides.',
    },
    '/sjeme/[slug]': { source: 'directory', reason: 'Seed catalogue entries.' },
    '/sjeme/brend/[slug]': {
        source: 'directory',
        reason: 'Seed brand pages.',
    },
    '/legalno/natjecaji/[occasionSlug]': {
        source: 'directory',
        reason: 'Official contest rules.',
    },
    '/vrtovi/[gardenId]': {
        source: 'gardens',
        reason: 'Public gardens that are past the starter garden.',
    },
    '/korisnici/[publicId]': {
        source: 'not-published',
        reason: 'Public profiles are rendered on demand and were never in the sitemap. Publishing them needs an opt-in signal per profile, which is out of scope here.',
    },
    '/pozdrav/[slug]': {
        source: 'excluded',
        reason: 'Redirects to the landing page.',
    },
    '/trag/[token]': {
        source: 'excluded',
        reason: 'Per-recipient tracking links.',
    },
    '/cjenik/preuzimanje/[id]': {
        source: 'excluded',
        reason: 'Signed CSV downloads.',
    },
};

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
 * Build every sitemap entry: the public hubs, CMS pages, eligible public
 * gardens and the catalogue detail pages. This is the complete URL set that
 * `app/sitemap.ts` publishes.
 */
export function collectSitemapSourceEntries({
    cmsPages,
    publicGardens,
    directoryEntries = [],
}: {
    cmsPages: ReadonlyArray<CmsSitemapPage>;
    publicGardens: ReadonlyArray<PublicGardenSitemapSource>;
    directoryEntries?: ReadonlyArray<DirectorySitemapSource>;
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

    for (const directoryEntry of directoryEntries) {
        entries.push({
            path: directoryEntry.path,
            lastmod: toSitemapLastmod(directoryEntry.updatedAt),
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
