import 'server-only';
import {
    type CmsNewsContentKind,
    getPublishedCmsNewsPageBySlug,
    getPublishedCmsNewsSourcePages,
} from '@gredice/storage';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { NEWS_PUBLISHED_TAG, newsArticleTag } from './newsCache';
import {
    buildPublishedNewsSummaries,
    isPublishedNewsPage,
    newsPageDetail,
    newsPageSourceEntry,
} from './newsSource';

type NewsListQuery = {
    category?: string;
    tag?: string;
    since?: string;
    limit?: number;
};

const primaryTagLimit = 8;
const recentPrimaryTagLimit = 4;

type NewsTagSource = {
    publishedAt?: string | null;
    tags: string[];
};

function normalizedTaxonomyValue(value: string | null | undefined) {
    return value?.trim().toLocaleLowerCase('hr-HR') || null;
}

async function readPublishedNewsSourceEntries() {
    const pages = await getPublishedCmsNewsSourcePages();
    return buildPublishedNewsSummaries(pages);
}

const getPublishedNewsSourceEntries = cache(
    unstable_cache(
        readPublishedNewsSourceEntries,
        ['news-published-summaries-v3'],
        { revalidate: 3600, tags: [NEWS_PUBLISHED_TAG] },
    ),
);

const getDailyPublishedNewsSourceEntries = cache(
    unstable_cache(
        readPublishedNewsSourceEntries,
        ['news-published-summaries-daily-v2'],
        { revalidate: 86_400, tags: [NEWS_PUBLISHED_TAG] },
    ),
);

function sourceEntryPublishedTime(
    entry: Awaited<ReturnType<typeof readPublishedNewsSourceEntries>>[number],
) {
    return Date.parse(entry.publishedAt);
}

async function getNewsEntries(
    contentKind: CmsNewsContentKind,
    query: NewsListQuery = {},
    getSourceEntries = getPublishedNewsSourceEntries,
) {
    const category = normalizedTaxonomyValue(query.category);
    const tag = normalizedTaxonomyValue(query.tag);
    const since = query.since ? new Date(query.since) : null;
    const publishedAfter =
        since && !Number.isNaN(since.getTime()) ? since.getTime() : null;
    const entries = await getSourceEntries();
    const items = entries.filter((entry) => {
        if (entry.contentKind !== contentKind) {
            return false;
        }

        if (category && normalizedTaxonomyValue(entry.category) !== category) {
            return false;
        }

        if (
            tag &&
            !entry.tags.some(
                (pageTag) => normalizedTaxonomyValue(pageTag) === tag,
            )
        ) {
            return false;
        }

        return (
            publishedAfter === null ||
            sourceEntryPublishedTime(entry) > publishedAfter
        );
    });
    const limit = query.limit
        ? Math.max(1, Math.min(query.limit, 50))
        : items.length;

    return items.slice(0, limit);
}

const getNewsEntry = cache((contentKind: CmsNewsContentKind, slug: string) => {
    const prefix =
        contentKind === 'changelog' ? 'novosti/sto-je-novo/' : 'novosti/';
    const cmsSlug = `${prefix}${slug}`;
    // Cache one public article, so driver fetches stay within Next's cache boundary.
    // Publication invalidation expires only this slug rather than every article.
    return unstable_cache(
        async () => {
            const page = await getPublishedCmsNewsPageBySlug(cmsSlug);
            return page && isPublishedNewsPage(page, contentKind)
                ? newsPageDetail(newsPageSourceEntry(page))
                : null;
        },
        ['news-published-article-v1', contentKind, slug],
        {
            revalidate: 3600,
            tags: [newsArticleTag(cmsSlug)],
        },
    )();
});

export function getBlogPosts(query: NewsListQuery = {}) {
    return getNewsEntries('blog', query);
}

export function getBlogPost(slug: string) {
    return getNewsEntry('blog', slug);
}

export function getChangelogEntries(
    query: Omit<NewsListQuery, 'category'> = {},
) {
    return getNewsEntries('changelog', query);
}

export function getDailyChangelogEntries(
    query: Omit<NewsListQuery, 'category'> = {},
) {
    return getNewsEntries(
        'changelog',
        query,
        getDailyPublishedNewsSourceEntries,
    );
}

export function getChangelogEntry(slug: string) {
    return getNewsEntry('changelog', slug);
}

export type NewsListItem = Awaited<ReturnType<typeof getBlogPosts>>[number];
export type NewsDetail = NonNullable<Awaited<ReturnType<typeof getBlogPost>>>;

export function formatNewsDate(value: string | Date | null) {
    if (!value) {
        return null;
    }

    return new Intl.DateTimeFormat('hr-HR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date(value));
}

export function uniqueNewsValues<T>(
    items: T[],
    getter: (item: T) => string | string[] | null | undefined,
) {
    const values = new Map<string, string>();
    for (const item of items) {
        const rawValue = getter(item);
        const itemValues = Array.isArray(rawValue) ? rawValue : [rawValue];
        for (const value of itemValues) {
            const normalized = value?.trim();
            if (!normalized) {
                continue;
            }

            values.set(normalized.toLocaleLowerCase('hr-HR'), normalized);
        }
    }

    return Array.from(values.values()).sort((left, right) =>
        left.localeCompare(right, 'hr-HR'),
    );
}

function normalizedNewsTime(value: string | null | undefined) {
    if (!value) {
        return 0;
    }

    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
}

export function getPrimaryNewsTags<T extends NewsTagSource>(entries: T[]) {
    const primaryTags = new Map<string, string>();
    const tagStats = new Map<
        string,
        {
            count: number;
            latestTime: number;
            value: string;
        }
    >();

    for (const entry of entries) {
        const latestTime = normalizedNewsTime(entry.publishedAt);

        for (const tag of entry.tags) {
            const normalized = tag.trim();
            if (!normalized) {
                continue;
            }

            const key = normalized.toLocaleLowerCase('hr-HR');
            if (primaryTags.size < recentPrimaryTagLimit) {
                primaryTags.set(key, normalized);
            }

            const current = tagStats.get(key);
            tagStats.set(key, {
                count: (current?.count ?? 0) + 1,
                latestTime: Math.max(current?.latestTime ?? 0, latestTime),
                value: current?.value ?? normalized,
            });
        }
    }

    const popularTags = Array.from(tagStats.values())
        .sort((left, right) => {
            const countDiff = right.count - left.count;
            if (countDiff !== 0) {
                return countDiff;
            }

            const latestDiff = right.latestTime - left.latestTime;
            if (latestDiff !== 0) {
                return latestDiff;
            }

            return left.value.localeCompare(right.value, 'hr-HR');
        })
        .map((item) => item.value);

    for (const tag of popularTags) {
        if (primaryTags.size >= primaryTagLimit) {
            break;
        }

        primaryTags.set(tag.toLocaleLowerCase('hr-HR'), tag);
    }

    return Array.from(primaryTags.values());
}
