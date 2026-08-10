import type { IConfig } from 'next-sitemap';
import { getSitemapSourcePaths } from './lib/sitemap/getSitemapSourcePaths';

function decodeUriComponentSafe(value: string) {
    try {
        return decodeURIComponent(value.replace(/%(?![0-9a-fA-F]{2})/g, '%25'));
    } catch {
        return value;
    }
}

function normalizeSitemapPath(path: string) {
    const [pathname, search = ''] = path.split('?');
    const normalizedPathname = pathname
        .split('/')
        .map((segment, index) =>
            index === 0
                ? segment
                : encodeURIComponent(decodeUriComponentSafe(segment)),
        )
        .join('/');

    return search ? `${normalizedPathname}?${search}` : normalizedPathname;
}

const config: IConfig = {
    siteUrl: process.env.SITE_URL || 'https://www.gredice.com',
    generateRobotsTxt: true,
    exclude: ['/trag/*', '/vrtovi', '/vrtovi/*'],
    robotsTxtOptions: {
        policies: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/trag/'],
            },
        ],
    },
    transform: async (sitemapConfig, path) => ({
        loc: normalizeSitemapPath(path),
        changefreq: sitemapConfig.changefreq,
        priority: sitemapConfig.priority,
        lastmod: sitemapConfig.autoLastmod
            ? new Date().toISOString()
            : undefined,
        alternateRefs: sitemapConfig.alternateRefs ?? [],
    }),
    additionalPaths: async (sitemapConfig) => {
        const paths = await getSitemapSourcePaths();
        const transformedPaths = await Promise.all(
            paths.map((path) => sitemapConfig.transform(sitemapConfig, path)),
        );
        return transformedPaths.filter((path) => path !== null);
    },
};

export default config;
