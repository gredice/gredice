import 'server-only';
import { clientPublic } from '@gredice/client';

type NewsListQuery = {
    category?: string;
    tag?: string;
    since?: string;
    limit?: number;
};

function newsQuery(input: NewsListQuery = {}) {
    return {
        ...(input.category ? { category: input.category } : {}),
        ...(input.tag ? { tag: input.tag } : {}),
        ...(input.since ? { since: input.since } : {}),
        ...(input.limit ? { limit: input.limit.toString() } : {}),
    };
}

export async function getBlogPosts(query: NewsListQuery = {}) {
    const response = await clientPublic().api.news.blog.$get({
        query: newsQuery(query),
    });
    if (!response.ok) {
        return [];
    }

    const body = await response.json();
    return body.items;
}

export async function getBlogPost(slug: string) {
    const response = await clientPublic().api.news.blog[':slug{.+}'].$get({
        param: { slug },
    });
    if (!response.ok) {
        return null;
    }

    return await response.json();
}

export async function getChangelogEntries(
    query: Omit<NewsListQuery, 'category'> = {},
) {
    const response = await clientPublic().api.news.changelog.$get({
        query: newsQuery(query),
    });
    if (!response.ok) {
        return [];
    }

    const body = await response.json();
    return body.items;
}

export async function getChangelogEntry(slug: string) {
    const response = await clientPublic().api.news.changelog[':slug{.+}'].$get({
        param: { slug },
    });
    if (!response.ok) {
        return null;
    }

    return await response.json();
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

export function uniqueNewsValues(
    items: NewsListItem[],
    getter: (item: NewsListItem) => string | string[] | null,
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
