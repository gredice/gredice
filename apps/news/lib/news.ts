import 'server-only';
import {
    type CmsNewsContentKind,
    type CmsPageContentDocument,
    cmsPagePublicPath,
    getCmsPages,
    parseCmsPageContent,
    type SelectCmsPage,
} from '@gredice/storage';

type SelectCmsNewsPage = Omit<SelectCmsPage, 'contentKind' | 'publishedAt'> & {
    contentKind: CmsNewsContentKind;
    publishedAt: Date;
};

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

const blogSlugPrefix = 'novosti/';
const changelogSlugPrefix = 'novosti/sto-je-novo/';

function newsEntrySlug(page: Pick<SelectCmsPage, 'contentKind' | 'slug'>) {
    if (page.contentKind === 'changelog') {
        return page.slug.startsWith(changelogSlugPrefix)
            ? page.slug.slice(changelogSlugPrefix.length)
            : page.slug;
    }

    return page.slug.startsWith(blogSlugPrefix)
        ? page.slug.slice(blogSlugPrefix.length)
        : page.slug;
}

function textExcerpt(value: string | undefined) {
    const normalized = value?.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return null;
    }

    return normalized.length > 180
        ? `${normalized.slice(0, 177).trimEnd()}...`
        : normalized;
}

function sectionExcerpt(section: Record<string, unknown>) {
    const description =
        typeof section.description === 'string' ? section.description : null;
    if (description) {
        return description;
    }

    const markdown =
        typeof section.markdown === 'string' ? section.markdown : null;
    if (markdown) {
        return markdown
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/!\[[^\]]*]\([^)]+\)/g, '')
            .replace(/\[[^\]]+]\([^)]+\)/g, (match) =>
                match.replace(/^\[|\]\([^)]+\)$/g, ''),
            );
    }

    return null;
}

function pageExcerpt(page: SelectCmsPage) {
    if (page.metaDescription) {
        return textExcerpt(page.metaDescription);
    }

    try {
        const content = parseCmsPageContent(page.content);
        for (const section of content.sections) {
            const excerpt = textExcerpt(sectionExcerpt(section) ?? undefined);
            if (excerpt) {
                return excerpt;
            }
        }
    } catch {
        return null;
    }

    return null;
}

function pageContent(page: SelectCmsPage): CmsPageContentDocument {
    try {
        return parseCmsPageContent(page.content);
    } catch {
        return {
            renderMode: 'container',
            renderMaxWidth: 'lg',
            sections: [],
        };
    }
}

function newsPageSummary(page: SelectCmsNewsPage) {
    return {
        id: page.id,
        contentKind: page.contentKind,
        slug: newsEntrySlug(page),
        cmsSlug: page.slug,
        path: cmsPagePublicPath(page),
        title: page.title,
        excerpt: pageExcerpt(page),
        category: page.category,
        tags: page.tags,
        publishedAt: page.publishedAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        metaImageUrl: page.metaImageUrl,
        metaImagePoiX: page.metaImagePoiX,
        metaImagePoiY: page.metaImagePoiY,
        seoImageUrl: page.seoImageUrl,
        canonicalPath: page.canonicalPath,
        noIndex: page.noIndex,
    };
}

function newsPageDetail(page: SelectCmsNewsPage) {
    const content = pageContent(page);
    return {
        ...newsPageSummary(page),
        content: content.sections,
        renderMode: content.renderMode,
        renderMaxWidth: content.renderMaxWidth,
    };
}

function normalizedTaxonomyValue(value: string | null | undefined) {
    return value?.trim().toLocaleLowerCase('hr-HR') || null;
}

function publishedTime(page: SelectCmsPage) {
    return page.publishedAt?.getTime() ?? 0;
}

function isPublishedNewsPage(
    page: SelectCmsPage,
    contentKind: CmsNewsContentKind,
): page is SelectCmsNewsPage {
    return page.contentKind === contentKind && page.publishedAt !== null;
}

async function getPublishedNewsSourcePages(contentKind: CmsNewsContentKind) {
    const pages = await getCmsPages({ state: 'published' });
    return pages
        .filter((page) => isPublishedNewsPage(page, contentKind))
        .sort(
            (left, right) =>
                publishedTime(right) - publishedTime(left) ||
                right.id - left.id,
        );
}

async function getNewsEntries(
    contentKind: CmsNewsContentKind,
    query: NewsListQuery = {},
) {
    const category = normalizedTaxonomyValue(query.category);
    const tag = normalizedTaxonomyValue(query.tag);
    const since = query.since ? new Date(query.since) : null;
    const publishedAfter =
        since && !Number.isNaN(since.getTime()) ? since.getTime() : null;
    const pages = await getPublishedNewsSourcePages(contentKind);
    const items = pages.filter((page) => {
        if (category && normalizedTaxonomyValue(page.category) !== category) {
            return false;
        }

        if (
            tag &&
            !page.tags.some(
                (pageTag) => normalizedTaxonomyValue(pageTag) === tag,
            )
        ) {
            return false;
        }

        return publishedAfter === null || publishedTime(page) > publishedAfter;
    });
    const limit = query.limit
        ? Math.max(1, Math.min(query.limit, 50))
        : items.length;

    return items.slice(0, limit).map(newsPageSummary);
}

async function getNewsEntry(contentKind: CmsNewsContentKind, slug: string) {
    const pages = await getPublishedNewsSourcePages(contentKind);
    const page = pages.find((candidate) => newsEntrySlug(candidate) === slug);
    return page ? newsPageDetail(page) : null;
}

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
