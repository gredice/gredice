import { getCmsPages } from '@gredice/storage';
import {
    buildPublishedNewsSourceEntries,
    buildPublishedNewsSummaries,
    newsPageDetail,
} from '../lib/newsSource';

const pages = await getCmsPages({ state: 'published' });
const entries = buildPublishedNewsSourceEntries(pages);
const bytes = (value: unknown) =>
    Buffer.byteLength(JSON.stringify(value), 'utf8');
const snapshots = [];
for (const url of [
    'https://www.gredice.com/novosti',
    'https://www.gredice.com/novosti/sto-je-novo',
]) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Gredice cache audit' },
    });
    snapshots.push({
        path: new URL(url).pathname,
        status: response.status,
        htmlBytes: Buffer.byteLength(await response.text(), 'utf8'),
        cache: response.headers.get('x-vercel-cache'),
        nextCache: response.headers.get('x-nextjs-cache'),
    });
}
// Aggregate metadata only: never print CMS bodies, unpublished pages, or secrets.
console.info(
    JSON.stringify({
        capturedAt: new Date().toISOString(),
        sourceKeys: [
            'news-published-source-pages-v2',
            'news-published-source-pages-daily-v1',
        ],
        publishedEntries: entries.length,
        fullSourceBytes: bytes(entries),
        summaryBytes: bytes(entries.map(({ summary }) => summary)),
        individualArticleJsonBytes: entries.reduce(
            (total, entry) => total + bytes(newsPageDetail(entry)),
            0,
        ),
        compactSummaryBytes: bytes(buildPublishedNewsSummaries(pages)),
        storagePublishedRowsBytes: bytes(pages),
        cacheRefreshTriggers: { hourlySeconds: 3600, dailySeconds: 86400 },
        snapshots,
    }),
);
