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

const sourceCmsPagePaths = ['/kvaliteta-i-sigurnost-uroda'];
const staticNewsPaths = ['/novosti', '/novosti/sto-je-novo'];

async function addNewsFeedPaths({ baseUrl, sitemapPaths }) {
    const feedPaths = ['/api/news/blog', '/api/news/changelog'];

    await Promise.all(
        feedPaths.map(async (feedPath) => {
            let response;
            try {
                response = await fetch(`${baseUrl}${feedPath}`);
            } catch {
                return;
            }

            if (!response.ok) {
                return;
            }

            /** @type {{ items?: Array<{ path?: string; noIndex?: boolean; publishedAt?: string | null }> }} */
            const feed = await response.json();
            for (const item of feed.items ?? []) {
                if (!item.path || item.noIndex || !item.publishedAt) {
                    continue;
                }

                sitemapPaths.add(item.path);
            }
        }),
    );
}

/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: process.env.SITE_URL || 'https://www.gredice.com',
    generateRobotsTxt: true,
    exclude: ['/trag/*'],
    robotsTxtOptions: {
        includeHost: false,
        policies: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/trag/'],
            },
        ],
    },
    transform: async (config, path) => ({
        loc: normalizeSitemapPath(path),
        changefreq: config.changefreq,
        priority: config.priority,
        lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
        alternateRefs: config.alternateRefs ?? [],
    }),
    additionalPaths: async (config) => {
        const sitemapPaths = new Set([
            ...sourceCmsPagePaths,
            ...staticNewsPaths,
        ]);
        const baseUrl = process.env.API_URL || 'https://api.gredice.com';
        let response;
        try {
            response = await fetch(`${baseUrl}/api/directories/pages`);
        } catch {
            return Promise.all(
                Array.from(sitemapPaths).map((path) =>
                    config.transform(config, path),
                ),
            );
        }

        if (response.ok) {
            /** @type {Array<{ slug: string; noIndex?: boolean; state: string; publishedAt?: string | null }>} */
            const pages = await response.json();
            pages
                .filter(
                    (page) =>
                        page.state === 'published' &&
                        page.publishedAt &&
                        !page.noIndex,
                )
                .map((page) => `/${page.slug}`)
                .forEach((path) => {
                    sitemapPaths.add(path);
                });
        }

        await addNewsFeedPaths({ baseUrl, sitemapPaths });

        const transformedPaths = await Promise.all(
            Array.from(sitemapPaths).map((path) =>
                config.transform(config, path),
            ),
        );
        return transformedPaths.filter(Boolean);
    },
};
