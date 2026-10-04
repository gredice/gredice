import 'server-only';
import {
    type CmsNewsContentKind,
    type CmsPageContentDocument,
    cmsPagePublicPath,
    parseCmsPageContent,
    type SelectCmsPage,
} from '@gredice/storage';

type SelectCmsNewsPage = Omit<SelectCmsPage, 'contentKind' | 'publishedAt'> & {
    contentKind: CmsNewsContentKind;
    publishedAt: Date;
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

export function newsPageSourceEntry(page: SelectCmsNewsPage) {
    const content = pageContent(page);
    return {
        summary: newsPageSummary(page),
        content: content.sections,
        renderMode: content.renderMode,
        renderMaxWidth: content.renderMaxWidth,
    };
}

export type NewsPageSourceEntry = ReturnType<typeof newsPageSourceEntry>;

export function newsPageDetail(entry: NewsPageSourceEntry) {
    return {
        ...entry.summary,
        content: entry.content,
        renderMode: entry.renderMode,
        renderMaxWidth: entry.renderMaxWidth,
    };
}

function publishedTime(page: SelectCmsPage) {
    return page.publishedAt?.getTime() ?? 0;
}

export function isPublishedNewsPage(
    page: SelectCmsPage,
    contentKind: CmsNewsContentKind,
): page is SelectCmsNewsPage {
    return (
        page.contentKind === contentKind &&
        page.state === 'published' &&
        !page.isDeleted &&
        page.publishedAt !== null
    );
}

function sortedPublishedNewsPages(pages: SelectCmsPage[]) {
    return pages
        .filter(
            (page) =>
                isPublishedNewsPage(page, 'blog') ||
                isPublishedNewsPage(page, 'changelog'),
        )
        .sort(
            (left, right) =>
                publishedTime(right) - publishedTime(left) ||
                right.id - left.id,
        );
}

export function buildPublishedNewsSourceEntries(pages: SelectCmsPage[]) {
    return sortedPublishedNewsPages(pages).map(newsPageSourceEntry);
}

/** Card and taxonomy data only; article metadata/content is read per slug. */
export function buildPublishedNewsSummaries(pages: SelectCmsPage[]) {
    return sortedPublishedNewsPages(pages).map((page) => {
        const summary = newsPageSummary(page);
        return {
            id: summary.id,
            contentKind: summary.contentKind,
            slug: summary.slug,
            title: summary.title,
            excerpt: summary.excerpt,
            category: summary.category,
            tags: summary.tags,
            publishedAt: summary.publishedAt,
            metaImageUrl: summary.metaImageUrl,
            metaImagePoiX: summary.metaImagePoiX,
            metaImagePoiY: summary.metaImagePoiY,
        };
    });
}
