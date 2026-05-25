import {
    type EntityStandardized,
    getCmsPageBySlug,
    getCmsPages,
    getEntitiesFormatted,
    getEntityFormatted,
    parseCmsPageContent,
    searchDirectoryEntities,
} from '@gredice/storage';
import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    cacheControlPresets,
    setCacheControl,
} from '../../../lib/http/cacheControl';

const localCmsPagePreviewSecret = 'local-preview-secret';

function isLocalPreviewHost(hostname: string) {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.gredice.test')
    );
}

function cmsPagePreviewSecret(requestUrl: string) {
    const configuredSecret = process.env.CMS_PAGES_PREVIEW_SECRET?.trim();
    if (configuredSecret) {
        return configuredSecret;
    }

    const hostname = new URL(requestUrl).hostname;
    return isLocalPreviewHost(hostname) ? localCmsPagePreviewSecret : null;
}

const app = new Hono()
    .get(
        '/search',
        zValidator(
            'query',
            z.object({
                q: z.string().trim().min(2).max(200),
                category: z.union([z.string(), z.array(z.string())]).optional(),
                entityType: z
                    .union([z.string(), z.array(z.string())])
                    .optional(),
                limit: z.coerce.number().int().min(1).max(50).optional(),
                offset: z.coerce.number().int().min(0).max(500).optional(),
            }),
        ),
        async (context) => {
            const query = context.req.valid('query');
            const limit = query.limit ?? 20;
            const offset = query.offset ?? 0;
            const categoriesRaw = Array.isArray(query.category)
                ? query.category
                : query.category
                  ? [query.category]
                  : [];
            const categories = categoriesRaw.map((value) =>
                value === 'operation' ? 'operations' : value,
            );
            const entityTypes = Array.isArray(query.entityType)
                ? query.entityType
                : query.entityType
                  ? [query.entityType]
                  : [];
            const rows = await searchDirectoryEntities({
                query: query.q,
                publicCategories: categories,
                entityTypeNames: entityTypes,
                limit,
                offset,
            });
            setCacheControl(context, cacheControlPresets.directories);
            return context.json({
                query: query.q,
                limit,
                offset,
                count: rows.length,
                results: rows.map((row) => ({
                    entityId: row.entityId,
                    entityType: row.entityTypeName,
                    category: row.publicCategory,
                    categoryLabel: row.publicCategoryLabel,
                    title: row.title,
                    summary: row.summary,
                    imageUrl: row.imageUrl,
                    imageAlt: row.imageAlt,
                    visualKey: row.visualKey,
                    href: `https://www.gredice.com${row.publicUrl}`,
                    rank: row.score,
                    publishedAt: row.publishedAt,
                    updatedAt: row.updatedAt,
                })),
            });
        },
    )
    .get('/pages', async (context) => {
        const pages = await getCmsPages({ state: 'published' });
        setCacheControl(context, cacheControlPresets.directories);
        return context.json(
            pages
                .filter((page) => page.publishedAt)
                .map((page) => ({
                    slug: page.slug,
                    title: page.title,
                    state: page.state,
                    publishedAt: page.publishedAt,
                    metaTitle: page.metaTitle,
                    metaDescription: page.metaDescription,
                    metaImageUrl: page.metaImageUrl,
                    canonicalPath: page.canonicalPath,
                    noIndex: page.noIndex,
                    updatedAt: page.updatedAt,
                })),
        );
    })
    .get(
        '/pages/:slug{.+}',
        zValidator(
            'query',
            z.object({
                draft: z.string().optional(),
            }),
        ),
        async (context) => {
            const slug = context.req.param('slug');
            const includeDraft = context.req.valid('query').draft === '1';
            const previewSecret = context.req.header('x-preview-secret');
            const expectedPreviewSecret = cmsPagePreviewSecret(context.req.url);

            const canAccessDraft =
                includeDraft &&
                Boolean(expectedPreviewSecret) &&
                previewSecret === expectedPreviewSecret;

            const page = await getCmsPageBySlug(slug);
            if (
                !page ||
                (!canAccessDraft &&
                    (page.state !== 'published' || !page.publishedAt))
            ) {
                return context.json(
                    { error: 'Page not found' },
                    { status: 404 },
                );
            }

            let content: unknown[] = [];
            let renderMode = 'container';
            let renderMaxWidth = 'lg';
            if (page.content) {
                try {
                    const parsed = parseCmsPageContent(page.content);
                    content = parsed.sections;
                    renderMode = parsed.renderMode;
                    renderMaxWidth = parsed.renderMaxWidth;
                } catch {
                    content = [];
                }
            }

            if (canAccessDraft) {
                context.header('Cache-Control', 'private, no-store');
            } else {
                setCacheControl(context, cacheControlPresets.directories);
            }
            return context.json({
                slug: page.slug,
                title: page.title,
                content,
                renderMode,
                renderMaxWidth,
                state: page.state,
                publishedAt: page.publishedAt,
                metaTitle: page.metaTitle,
                metaDescription: page.metaDescription,
                metaImageUrl: page.metaImageUrl,
                canonicalPath: page.canonicalPath,
                noIndex: page.noIndex,
                updatedAt: page.updatedAt,
            });
        },
    )
    .get(
        '/entities/:entityType',
        zValidator(
            'param',
            z.object({
                entityType: z.string(),
            }),
        ),
        async (context) => {
            const { entityType } = context.req.valid('param');
            const entities = await getEntitiesFormatted(entityType);
            setCacheControl(context, cacheControlPresets.directories);
            return context.json(entities);
        },
    )
    .get(
        '/entities/:entityType/:entityId',
        zValidator(
            'param',
            z.object({
                entityType: z.string(),
                entityId: z.string(),
            }),
        ),
        async (context) => {
            const { entityType, entityId } = context.req.valid('param');
            const entityIdNumber = parseInt(entityId, 10);
            if (Number.isNaN(entityIdNumber)) {
                return context.json(
                    { error: 'Invalid entityId' },
                    { status: 400 },
                );
            }
            const entity =
                await getEntityFormatted<EntityStandardized>(entityIdNumber);
            if (!entity || entity.entityType?.name !== entityType) {
                return context.json(
                    { error: 'Entity not found' },
                    { status: 404 },
                );
            }
            setCacheControl(context, cacheControlPresets.directories);
            return context.json(entity);
        },
    );

export default app;
