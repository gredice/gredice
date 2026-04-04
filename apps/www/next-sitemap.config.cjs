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
    transform: async (config, path) => ({
        loc: normalizeSitemapPath(path),
        changefreq: config.changefreq,
        priority: config.priority,
        lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
        alternateRefs: config.alternateRefs ?? [],
    }),
};
