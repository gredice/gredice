/**
 * Build the sitemap URL inventory by route family.
 *
 * Usage (from `apps/www`, after `pnpm build`):
 *
 *   pnpm run sitemap:inventory
 *   pnpm run sitemap:inventory -- --probe --base-url=https://www.gredice.com
 *   pnpm run sitemap:inventory -- --impressions=./search-console.csv
 *
 * Without `--probe` the report covers the URL set and its `lastmod` coverage.
 * With `--probe` every URL is fetched so the report also carries HTTP status,
 * the rendered robots directive, the rendered canonical and whether the page
 * has body content. `--impressions` merges a Search Console export (a CSV with
 * a URL column and an impressions column).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseStringPromise } from 'xml2js';
import {
    formatSitemapInventoryMarkdown,
    type SitemapInventoryRecord,
    summarizeSitemapInventory,
} from '../lib/sitemap/sitemapInventory.ts';

type SitemapUrlEntry = {
    loc: [string];
    lastmod?: [string];
};

function readArgument(name: string) {
    const prefix = `--${name}=`;
    const argument = process.argv.find((value) => value.startsWith(prefix));
    return argument ? argument.slice(prefix.length) : null;
}

function hasFlag(name: string) {
    return process.argv.includes(`--${name}`);
}

async function readSitemapUrls(
    sitemapPath: string,
): Promise<Array<{ loc: string; lastmod: string | null }>> {
    const parsed = await parseStringPromise(
        await readFile(sitemapPath, 'utf8'),
    );

    if (parsed.sitemapindex) {
        const nested = await Promise.all(
            (parsed.sitemapindex.sitemap ?? []).map(
                (sitemap: { loc: [string] }) =>
                    readSitemapUrls(
                        path.join(
                            path.dirname(sitemapPath),
                            path.basename(new URL(sitemap.loc[0]).pathname),
                        ),
                    ),
            ),
        );
        return nested.flat();
    }

    return (parsed.urlset?.url ?? []).map((url: SitemapUrlEntry) => ({
        loc: url.loc[0],
        lastmod: url.lastmod?.[0] ?? null,
    }));
}

async function readImpressions(csvPath: string) {
    const rows = (await readFile(csvPath, 'utf8'))
        .split(/\r?\n/u)
        .filter((row) => row.trim().length > 0)
        .map((row) => row.split(',').map((cell) => cell.trim()));
    const [header, ...dataRows] = rows;
    if (!header) {
        return new Map<string, number>();
    }

    const urlIndex = header.findIndex((cell) =>
        /url|page|stranic/iu.test(cell),
    );
    const impressionsIndex = header.findIndex((cell) =>
        /impression|prikaz/iu.test(cell),
    );
    const impressions = new Map<string, number>();
    if (urlIndex < 0 || impressionsIndex < 0) {
        return impressions;
    }

    for (const row of dataRows) {
        const url = row[urlIndex];
        const value = Number(row[impressionsIndex]?.replace(/\s/gu, ''));
        if (!url || !Number.isFinite(value)) {
            continue;
        }

        try {
            impressions.set(new URL(url).pathname, value);
        } catch {
            impressions.set(url, value);
        }
    }

    return impressions;
}

function textContent(html: string) {
    const main = /<main[^>]*>([\s\S]*?)<\/main>/iu.exec(html)?.[1] ?? html;
    return main
        .replace(/<script[\s\S]*?<\/script>/giu, ' ')
        .replace(/<style[\s\S]*?<\/style>/giu, ' ')
        .replace(/<[^>]+>/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
}

async function probe(url: string): Promise<Partial<SitemapInventoryRecord>> {
    try {
        const response = await fetch(url, { redirect: 'manual' });
        if (!response.ok) {
            return { status: response.status };
        }

        const html = await response.text();
        const robots =
            /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/iu.exec(
                html,
            )?.[1] ?? null;
        const canonical =
            /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/iu.exec(
                html,
            )?.[1] ?? null;

        return {
            status: response.status,
            indexable: robots ? !/noindex/iu.test(robots) : true,
            canonical,
            hasContent: textContent(html).length > 200,
        };
    } catch {
        return { status: null };
    }
}

async function probeAll(
    records: SitemapInventoryRecord[],
    baseUrl: string,
    concurrency: number,
) {
    let cursor = 0;
    const workers = Array.from({ length: concurrency }, async () => {
        while (cursor < records.length) {
            const record = records[cursor++];
            if (!record) {
                return;
            }
            Object.assign(
                record,
                await probe(new URL(record.path, baseUrl).toString()),
            );
        }
    });

    await Promise.all(workers);
}

async function main() {
    const sitemapPath = readArgument('sitemap') ?? './public/sitemap.xml';
    const outputDirectory = readArgument('out-dir') ?? './sitemap-inventory';
    const impressionsPath = readArgument('impressions');
    const baseUrl =
        readArgument('base-url') ??
        process.env.SITE_URL ??
        'https://www.gredice.com';

    const urls = await readSitemapUrls(sitemapPath);
    const impressions = impressionsPath
        ? await readImpressions(impressionsPath)
        : new Map<string, number>();

    const records: SitemapInventoryRecord[] = urls.map((url) => {
        const pathname = new URL(url.loc).pathname;
        return {
            path: pathname,
            lastmod: url.lastmod,
            impressions: impressions.get(pathname) ?? null,
        };
    });

    if (hasFlag('probe')) {
        await probeAll(
            records,
            baseUrl,
            Number(readArgument('concurrency') ?? '8') || 8,
        );
    }

    const rows = summarizeSitemapInventory(records);
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
        path.join(outputDirectory, 'sitemap-inventory.md'),
        formatSitemapInventoryMarkdown(rows),
    );
    await writeFile(
        path.join(outputDirectory, 'sitemap-inventory.json'),
        `${JSON.stringify({ rows, records }, null, 2)}\n`,
    );

    console.info(formatSitemapInventoryMarkdown(rows));
    console.info(`Inventar zapisan u ${outputDirectory}`);
}

await main();
