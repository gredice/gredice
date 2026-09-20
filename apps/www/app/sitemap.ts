import type { MetadataRoute } from 'next';
import { PUBLIC_SITE_ORIGIN } from '../lib/seo/publicMetadata';
import { getSitemapEntries } from '../lib/sitemap/getSitemapSourcePaths';
import { toSitemapUrl } from '../lib/sitemap/sitemapPolicy';

// Prerendered with the catalogue pages and refreshed on the same 12-hour
// interval, so published content reaches the sitemap without a deployment.
export const revalidate = 43200;

/**
 * The public sitemap.
 *
 * Every URL comes from `getSitemapEntries`: nothing scans the route tree, so
 * the source model is the single source of truth and `sitemapRouteCoverage`
 * tests guard it against a public page being added without an entry.
 *
 * `changefreq` and `priority` are deliberately absent. Google ignores both, and
 * the previous generator stamped identical values on all ~1,000 URLs, which
 * carried no information. A single sitemap stays correct up to 50,000 URLs; past
 * that this route needs `generateSitemaps`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const entries = await getSitemapEntries();

    return entries.map((entry) => ({
        url: toSitemapUrl(PUBLIC_SITE_ORIGIN, entry.path),
        ...(entry.lastmod ? { lastModified: entry.lastmod } : {}),
    }));
}
