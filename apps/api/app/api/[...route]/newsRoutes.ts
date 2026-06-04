import {
    type CmsNewsContentKind,
    cmsPagePublicPath,
    getCmsPageBySlug,
    getPublishedCmsNewsPages,
    parseCmsPageContent,
    type SelectCmsPage,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { publicSecurity } from '../../../lib/docs/security';
import {
    cacheControlPresets,
    setCacheControl,
} from '../../../lib/http/cacheControl';

const blogSlugPrefix = 'novosti/';
const changelogSlugPrefix = 'novosti/sto-je-novo/';

const newsListQuerySchema = z.object({
    category: z.string().trim().min(1).max(80).optional(),
    tag: z.string().trim().min(1).max(80).optional(),
    since: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
});

function parsePublishedAfter(value: string | undefined) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

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

function pageContent(page: SelectCmsPage) {
    try {
        return parseCmsPageContent(page.content);
    } catch {
        return {
            renderMode: 'container' as const,
            renderMaxWidth: 'lg' as const,
            sections: [],
        };
    }
}

function newsPageSummary(page: SelectCmsPage) {
    return {
        id: page.id,
        contentKind: page.contentKind as CmsNewsContentKind,
        slug: newsEntrySlug(page),
        cmsSlug: page.slug,
        path: cmsPagePublicPath(page),
        title: page.title,
        excerpt: pageExcerpt(page),
        category: page.category,
        tags: page.tags,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        metaImageUrl: page.metaImageUrl,
        canonicalPath: page.canonicalPath,
        noIndex: page.noIndex,
    };
}

function newsPageDetail(page: SelectCmsPage) {
    const content = pageContent(page);
    return {
        ...newsPageSummary(page),
        content: content.sections,
        renderMode: content.renderMode,
        renderMaxWidth: content.renderMaxWidth,
    };
}

async function getPublishedNewsPageBySlug(
    contentKind: CmsNewsContentKind,
    slug: string,
) {
    const cmsSlug =
        contentKind === 'changelog'
            ? `${changelogSlugPrefix}${slug}`
            : `${blogSlugPrefix}${slug}`;
    const page = await getCmsPageBySlug(cmsSlug);
    if (
        page?.state !== 'published' ||
        !page.publishedAt ||
        page.contentKind !== contentKind
    ) {
        return null;
    }

    return page;
}

const app = new Hono()
    .get(
        '/blog',
        describeRoute({
            description:
                'List published Novosti blog posts managed through CMS pages.',
            security: publicSecurity,
            tags: ['News'],
        }),
        zValidator('query', newsListQuerySchema),
        async (context) => {
            const query = context.req.valid('query');
            const pages = await getPublishedCmsNewsPages({
                contentKind: 'blog',
                category: query.category,
                tag: query.tag,
                publishedAfter: parsePublishedAfter(query.since),
                limit: query.limit,
            });
            setCacheControl(context, cacheControlPresets.directories);
            return context.json({
                items: pages.map(newsPageSummary),
            });
        },
    )
    .get(
        '/blog/:slug{.+}',
        describeRoute({
            description:
                'Get one published Novosti blog post by its public slug.',
            security: publicSecurity,
            tags: ['News'],
        }),
        zValidator('param', z.object({ slug: z.string().min(1) })),
        async (context) => {
            const { slug } = context.req.valid('param');
            const page = await getPublishedNewsPageBySlug('blog', slug);
            if (!page) {
                return context.json(
                    { error: 'Blog post not found' },
                    { status: 404 },
                );
            }

            setCacheControl(context, cacheControlPresets.directories);
            return context.json(newsPageDetail(page));
        },
    )
    .get(
        '/changelog',
        describeRoute({
            description:
                'List published Novosti changelog entries managed through CMS pages.',
            security: publicSecurity,
            tags: ['News'],
        }),
        zValidator('query', newsListQuerySchema.omit({ category: true })),
        async (context) => {
            const query = context.req.valid('query');
            const pages = await getPublishedCmsNewsPages({
                contentKind: 'changelog',
                tag: query.tag,
                publishedAfter: parsePublishedAfter(query.since),
                limit: query.limit,
            });
            setCacheControl(context, cacheControlPresets.directories);
            return context.json({
                items: pages.map(newsPageSummary),
            });
        },
    )
    .get(
        '/changelog/:slug{.+}',
        describeRoute({
            description:
                'Get one published Novosti changelog entry by its public slug.',
            security: publicSecurity,
            tags: ['News'],
        }),
        zValidator('param', z.object({ slug: z.string().min(1) })),
        async (context) => {
            const { slug } = context.req.valid('param');
            const page = await getPublishedNewsPageBySlug('changelog', slug);
            if (!page) {
                return context.json(
                    { error: 'Changelog entry not found' },
                    { status: 404 },
                );
            }

            setCacheControl(context, cacheControlPresets.directories);
            return context.json(newsPageDetail(page));
        },
    );

export default app;
