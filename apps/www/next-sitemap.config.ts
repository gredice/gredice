import type { IConfig, ISitemapField } from 'next-sitemap';
import {
    getSitemapLastmodIndex,
    getSitemapSourcePaths,
} from './lib/sitemap/getSitemapSourcePaths';
import {
    excludedSitemapRoutes,
    isExcludedSitemapPath,
    normalizeSitemapPath,
    sitemapPathKey,
} from './lib/sitemap/sitemapPolicy';

// `next-sitemap` appends `additionalPaths` to the routes discovered from the
// build output without deduplicating them, and its `exclude` globs only apply
// to the discovered set. Gating every URL through `transform` keeps one policy
// for both sources and publishes each page exactly once.
const emittedPathKeys = new Set<string>();

const config: IConfig = {
    siteUrl: process.env.SITE_URL || 'https://www.gredice.com',
    generateRobotsTxt: true,
    // Timestamps come from the content source, never from the build clock: an
    // unchanged page must not acquire a new `lastmod` on every deployment.
    autoLastmod: false,
    exclude: [...excludedSitemapRoutes],
    robotsTxtOptions: {
        // Pages dropped from the sitemap stay crawlable so robots can read
        // their `noindex` directive. Only personalised tracking links are
        // disallowed.
        policies: [
            {
                userAgent: 'Googlebot',
                allow: '/',
                disallow: ['/trag/'],
            },
            {
                userAgent: 'OAI-SearchBot',
                allow: '/',
                disallow: ['/trag/'],
            },
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/trag/'],
            },
        ],
    },
    transform: async (sitemapConfig, path) => {
        const loc = normalizeSitemapPath(path);
        if (isExcludedSitemapPath(loc)) {
            return undefined;
        }

        const pathKey = sitemapPathKey(loc);
        if (emittedPathKeys.has(pathKey)) {
            return undefined;
        }
        emittedPathKeys.add(pathKey);

        const lastmod = (await getSitemapLastmodIndex()).get(pathKey);
        return {
            loc,
            changefreq: sitemapConfig.changefreq,
            priority: sitemapConfig.priority,
            ...(lastmod ? { lastmod } : {}),
            alternateRefs: sitemapConfig.alternateRefs ?? [],
        };
    },
    additionalPaths: async (sitemapConfig) => {
        const paths = await getSitemapSourcePaths();
        const fields = await Promise.all(
            paths.map((path) => sitemapConfig.transform(sitemapConfig, path)),
        );
        return fields.filter((field): field is ISitemapField => Boolean(field));
    },
};

export default config;
