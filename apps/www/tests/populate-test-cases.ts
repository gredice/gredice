import { writeFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';

interface SitemapUrl {
    loc: [string];
    [key: string]: unknown;
}

// Helper to fetch and parse sitemap.xml
async function getSitemapPages(sitemapUrl: string): Promise<string[]> {
    const res = await fetch(sitemapUrl);
    if (!res.ok) throw new Error(`Failed to fetch sitemap: ${res.status}`);
    const xml = await res.text();
    const parsed = await parseStringPromise(xml);

    let allUrls: string[] = [];

    // Check if this is a sitemap index
    if (parsed.sitemapindex) {
        // This is a sitemap index, fetch each sitemap
        const sitemaps = parsed.sitemapindex.sitemap;
        for (const sitemap of sitemaps) {
            const sitemapLoc = sitemap.loc[0];
            const sitemapRes = await fetch(sitemapLoc);
            if (sitemapRes.ok) {
                const sitemapXml = await sitemapRes.text();
                const sitemapParsed = await parseStringPromise(sitemapXml);
                if (sitemapParsed.urlset?.url) {
                    const urls = sitemapParsed.urlset.url.map(
                        (u: SitemapUrl) => u.loc[0],
                    );
                    allUrls.push(...urls);
                }
            }
        }
    } else if (parsed.urlset?.url) {
        allUrls = parsed.urlset.url.map((u: SitemapUrl) => u.loc[0]);
    }

    // Convert to relative paths for local testing
    const relativeUrls = allUrls.map((url) => {
        const u = new URL(url);
        return u.pathname + (u.search || '');
    });

    relativeUrls.forEach((url) => {
        console.info(`Found page: ${url}`);
    });

    return relativeUrls;
}

await writeFile(
    './tests/sitemap-pages.json',
    JSON.stringify(
        await getSitemapPages('https://www.gredice.com/sitemap.xml'),
    ),
);
