function decodeUriComponentSafe(value) {
    try {
        return decodeURIComponent(value.replace(/%(?![0-9a-fA-F]{2})/g, '%25'));
    } catch {
        return value;
    }
}

function normalizeSitemapPath(path) {
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

/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: process.env.SITE_URL || 'https://www.gredice.com',
    generateRobotsTxt: true,
    robotsTxtOptions: {
        includeHost: false,
    },
    transform: async (config, path) => ({
        loc: normalizeSitemapPath(path),
        changefreq: config.changefreq,
        priority: config.priority,
        lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
        alternateRefs: config.alternateRefs ?? [],
    }),
    additionalPaths: async (config) => {
        const baseUrl = process.env.API_URL || 'https://api.gredice.com';
        let response;
        try {
            response = await fetch(`${baseUrl}/api/directories/pages`);
        } catch {
            return [];
        }

        if (!response.ok) {
            return [];
        }

        /** @type {Array<{ slug: string; noIndex?: boolean; state: string; publishedAt?: string | null }>} */
        const pages = await response.json();
        const seen = new Set();
        const sitemapPaths = await Promise.all(
            pages
                .filter(
                    (page) =>
                        page.state === 'published' &&
                        page.publishedAt &&
                        !page.noIndex,
                )
                .map((page) => `/${page.slug}`)
                .filter((path) => {
                    if (seen.has(path)) {
                        return false;
                    }
                    seen.add(path);
                    return true;
                })
                .map((path) => config.transform(config, path)),
        );
        return sitemapPaths.filter(Boolean);
    },
};
