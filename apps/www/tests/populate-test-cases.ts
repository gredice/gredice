import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseStringPromise } from 'xml2js';

interface SitemapUrl {
    loc: [string];
    [key: string]: unknown;
}

const NON_PAGE_ROUTE_SEGMENTS = new Set(['opengraph-image']);

async function readSitemapFile(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8');
}

function isPageRoute(relativeUrl: string): boolean {
    const url = new URL(relativeUrl, 'https://www.gredice.test');

    if (path.extname(url.pathname)) {
        return false;
    }

    const lastSegment = url.pathname.split('/').filter(Boolean).at(-1);
    return !lastSegment || !NON_PAGE_ROUTE_SEGMENTS.has(lastSegment);
}

// Parse the local sitemap files produced by the app build.
async function getSitemapPages(sitemapPath: string): Promise<string[]> {
    const xml = await readSitemapFile(sitemapPath);
    const parsed = await parseStringPromise(xml);

    let allUrls: string[] = [];

    // Check if this is a sitemap index
    if (parsed.sitemapindex) {
        // This is a sitemap index, read each nested sitemap file from disk.
        const sitemaps = parsed.sitemapindex.sitemap;
        for (const sitemap of sitemaps) {
            const sitemapLoc = sitemap.loc[0];
            const sitemapFilePath = path.join(
                path.dirname(sitemapPath),
                path.basename(new URL(sitemapLoc).pathname),
            );
            const sitemapXml = await readSitemapFile(sitemapFilePath);
            const sitemapParsed = await parseStringPromise(sitemapXml);
            if (sitemapParsed.urlset?.url) {
                const urls = sitemapParsed.urlset.url.map(
                    (u: SitemapUrl) => u.loc[0],
                );
                allUrls.push(...urls);
            }
        }
    } else if (parsed.urlset?.url) {
        allUrls = parsed.urlset.url.map((u: SitemapUrl) => u.loc[0]);
    }

    // Convert to relative paths for local testing
    const relativeUrls = allUrls
        .map((url) => {
            const u = new URL(url);
            return u.pathname + (u.search || '');
        })
        .filter(isPageRoute);

    relativeUrls.forEach((url) => {
        console.info(`Found page: ${url}`);
    });

    return relativeUrls;
}

await writeFile(
    './tests/sitemap-pages.json',
    JSON.stringify(await getSitemapPages('./public/sitemap.xml')),
);
