/**
 * Sitemap policy shared by `app/sitemap.ts`, the database-driven source model
 * and the inventory report.
 *
 * The sitemap must describe canonical, indexable public pages and nothing else.
 * Nothing discovers routes for us: `app/sitemap.ts` publishes exactly what the
 * source model returns, so this module is the single gate every candidate path
 * passes through.
 */

export type SitemapEntry = {
    /** Public path, always root-relative. */
    path: string;
    /**
     * ISO timestamp of the last meaningful content update. Omitted when no
     * reliable timestamp exists - build time is not an update date.
     */
    lastmod?: string;
};

/**
 * Patterns for routes that must never appear in a page sitemap. They also
 * document the policy for the route-coverage test, which checks every public
 * page in `app/` against this list.
 *
 * `*` matches a single path segment, `**` matches any number of segments.
 */
export const excludedSitemapRoutes = [
    // Icons, manifests and social images are assets, not indexable pages.
    '/apple-icon.png',
    '/favicon.ico',
    '/icon.png',
    '/icon.svg',
    '/manifest.json',
    '/opengraph-image',
    '/**/opengraph-image',
    // Machine-readable resources stay crawlable but are not pages.
    '/llms.txt',
    '/llms-full.txt',
    '/.well-known/**',
    // Endpoints, including CMS draft/preview plumbing.
    '/api/**',
    // Internal tooling.
    '/development',
    '/development/**',
    // Personalised tracking links and sign-in round trips.
    '/trag/*',
    '/prijava/**',
    // Raw CSV exports, the download index and per-snapshot downloads are
    // files and file listings, not content pages.
    '/cjenik/cjenik.csv',
    '/cjenik/preuzimanje',
    '/cjenik/preuzimanje/*',
    // Search and filter permutations of catalogue hubs.
    '/pretraga',
    '/pretraga/*',
    '/blokovi/biljke/generator',
    // Redirect-only greeting routes have no canonical content of their own.
    '/pozdrav',
    '/pozdrav/*',
] as const;

/**
 * Paths whose query string is part of the canonical URL. Every other query
 * string marks a search/filter permutation of a canonical hub, which must stay
 * out of the sitemap even though the page itself remains crawlable.
 */
export const canonicalQuerySitemapPaths: readonly string[] = [];

const excludedSitemapRoutePatterns = excludedSitemapRoutes.map((pattern) =>
    toPathSegments(pattern),
);
const canonicalQuerySitemapPathSet = new Set(canonicalQuerySitemapPaths);

function toPathSegments(path: string) {
    return path.split('/').filter(Boolean);
}

function decodeUriComponentSafe(value: string) {
    try {
        return decodeURIComponent(value.replace(/%(?![0-9a-fA-F]{2})/g, '%25'));
    } catch {
        return value;
    }
}

function matchesSegments(
    segments: readonly string[],
    patternSegments: readonly string[],
): boolean {
    if (patternSegments.length === 0) {
        return segments.length === 0;
    }

    const [pattern, ...remainingPatterns] = patternSegments;
    if (pattern === '**') {
        for (let index = 0; index <= segments.length; index++) {
            if (matchesSegments(segments.slice(index), remainingPatterns)) {
                return true;
            }
        }
        return false;
    }

    if (segments.length === 0) {
        return false;
    }

    const [segment, ...remainingSegments] = segments;
    if (pattern !== '*' && pattern !== segment) {
        return false;
    }

    return matchesSegments(remainingSegments, remainingPatterns);
}

/**
 * Normalise a path into the form written to the sitemap: percent-encoded
 * segments, no trailing slash and no duplicate slashes.
 */
export function normalizeSitemapPath(path: string) {
    const [rawPathname = '', search = ''] = path.split('?');
    const segments = toPathSegments(rawPathname).map((segment) =>
        encodeURIComponent(decodeUriComponentSafe(segment)),
    );
    const pathname = segments.length > 0 ? `/${segments.join('/')}` : '/';

    return search ? `${pathname}?${search}` : pathname;
}

/** Key used to keep a path in the sitemap exactly once. */
export function sitemapPathKey(path: string) {
    return normalizeSitemapPath(path);
}

/** True when the path must be kept out of the page sitemap. */
export function isExcludedSitemapPath(path: string) {
    const normalized = normalizeSitemapPath(path);
    const [pathname = '/', search] = normalized.split('?');

    if (search && !canonicalQuerySitemapPathSet.has(normalized)) {
        return true;
    }

    const segments = toPathSegments(pathname);
    return excludedSitemapRoutePatterns.some((patternSegments) =>
        matchesSegments(segments, patternSegments),
    );
}

/** Absolute URL for a sitemap entry. */
export function toSitemapUrl(origin: string, path: string) {
    const normalized = normalizeSitemapPath(path);
    return normalized === '/' ? origin : `${origin}${normalized}`;
}

/** Convert a content timestamp into a sitemap `lastmod`, or `undefined`. */
export function toSitemapLastmod(value: Date | string | null | undefined) {
    if (value === null || value === undefined) {
        return undefined;
    }

    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    if (!Number.isFinite(time)) {
        return undefined;
    }

    return date.toISOString();
}

/**
 * Apply the exclusion policy, drop duplicates and keep the most recent known
 * timestamp for every remaining path.
 */
export function mergeSitemapEntries(
    entries: ReadonlyArray<SitemapEntry>,
): SitemapEntry[] {
    const entriesByKey = new Map<string, SitemapEntry>();

    for (const entry of entries) {
        if (isExcludedSitemapPath(entry.path)) {
            continue;
        }

        const path = normalizeSitemapPath(entry.path);
        const key = sitemapPathKey(path);
        const lastmod = toSitemapLastmod(entry.lastmod);
        const existing = entriesByKey.get(key);

        if (!existing) {
            entriesByKey.set(key, lastmod ? { path, lastmod } : { path });
            continue;
        }

        if (lastmod && (!existing.lastmod || existing.lastmod < lastmod)) {
            entriesByKey.set(key, { path, lastmod });
        }
    }

    return [...entriesByKey.values()].sort((left, right) =>
        left.path.localeCompare(right.path),
    );
}
