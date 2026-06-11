import 'server-only';
import { slugify } from '@gredice/js/slug';
import { and, desc, eq, gt, ne, sql } from 'drizzle-orm';
import {
    cmsPageRevisions,
    cmsPages,
    type InsertCmsPage,
    type InsertCmsPageRevision,
    type SelectCmsPage,
    storage,
} from '..';
import {
    bustCached,
    cacheKeys,
    directoriesCached,
} from '../cache/directoriesCached';
import { normalizeCmsPageContent as normalizeCmsPageContentPayload } from '../cmsPageContent';

export type CmsPageState = 'draft' | 'in-review' | 'published';
export const cmsPageContentKinds = ['page', 'blog', 'changelog'] as const;
export type CmsPageContentKind = (typeof cmsPageContentKinds)[number];
export type CmsNewsContentKind = Exclude<CmsPageContentKind, 'page'>;

export type CreateCmsPageInput = {
    slug: string;
    title: string;
    content?: string | null;
    contentKind?: CmsPageContentKind | null;
    category?: string | null;
    tags?: string[] | null;
    state?: CmsPageState;
    metaTitle?: string | null;
    metaDescription?: string | null;
    metaImageUrl?: string | null;
    seoImageUrl?: string | null;
    canonicalPath?: string | null;
    noIndex?: boolean;
    publishedAt?: Date | string | null;
};

export type UpdateCmsPageInput = Partial<CreateCmsPageInput> & {
    id: number;
};
type CmsActor = { id?: string; name?: string };

export type GetCmsPagesOptions = {
    state?: CmsPageState;
    includeDeleted?: boolean;
};

export type GetPublishedCmsNewsPagesOptions = {
    contentKind?: CmsNewsContentKind;
    category?: string | null;
    tag?: string | null;
    publishedAfter?: Date | null;
    limit?: number;
};

export function isCmsPageState(value: string): value is CmsPageState {
    return value === 'draft' || value === 'in-review' || value === 'published';
}

export function isCmsPageContentKind(
    value: string,
): value is CmsPageContentKind {
    return cmsPageContentKinds.includes(value as CmsPageContentKind);
}

const reservedCmsPageFirstSegments = new Set([
    '.well-known',
    '_next',
    'admin',
    'api',
    'biljke',
    'bolesti',
    'blokovi',
    'cesta-pitanja',
    'checkout',
    'cjenik',
    'debug',
    'development',
    'docs',
    'dostava',
    'kontakt',
    'korisnici',
    'legalno',
    'logout',
    'manifest.json',
    'novosti',
    'o-nama',
    'odjava',
    'outlet',
    'podignuta-gredica',
    'povrati-i-povrat-novca',
    'pozdrav',
    'preporuke',
    'prijava',
    'racun',
    'radnje',
    'recepti',
    'robots.txt',
    'schedule',
    'stetnici',
    'sjetva',
    'suncokreti',
    'vodic-za-prvu-gredicu',
    'vrtovi',
]);

function optionalText(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function optionalTaxonomyText(value: string | null | undefined) {
    return optionalText(value)?.replace(/\s+/g, ' ') ?? null;
}

function normalizeCmsPageContentKind(
    value: CmsPageContentKind | string | null | undefined,
) {
    return value && isCmsPageContentKind(value) ? value : 'page';
}

function normalizeCmsPageTags(value: string[] | null | undefined) {
    if (!value?.length) {
        return [];
    }

    const seen = new Set<string>();
    const normalizedTags: string[] = [];
    for (const tag of value) {
        const normalized = optionalTaxonomyText(tag);
        if (!normalized) {
            continue;
        }

        const key = normalized.toLocaleLowerCase('hr-HR');
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        normalizedTags.push(normalized);
    }

    return normalizedTags;
}

function lowerTaxonomyValue(value: string | null | undefined) {
    return optionalTaxonomyText(value)?.toLocaleLowerCase('hr-HR') ?? null;
}

function boundedOptionalText(
    value: string | null | undefined,
    fieldLabel: string,
    maxLength: number,
) {
    const normalized = optionalText(value);
    if (normalized && normalized.length > maxLength) {
        throw new Error(
            `${fieldLabel} must be at most ${maxLength} characters.`,
        );
    }
    return normalized;
}

function requiredText(value: string, fieldLabel: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${fieldLabel} is required.`);
    }
    return trimmed;
}

function optionalDate(
    value: Date | string | null | undefined,
    fieldLabel: string,
) {
    if (value === null || value === undefined) {
        return null;
    }

    let date: Date;
    if (value instanceof Date) {
        date = value;
    } else {
        const normalized = optionalText(value);
        if (!normalized) {
            return null;
        }
        date = new Date(normalized);
    }

    if (Number.isNaN(date.getTime())) {
        throw new Error(`${fieldLabel} must be a valid date.`);
    }

    return date;
}

function resolveSlugSegments(value: string) {
    return value
        .trim()
        .split('/')
        .map((segment) => slugify(segment))
        .filter((segment) => segment.length > 0);
}

export function normalizeCmsPageSlug(value: string) {
    return resolveSlugSegments(value).join('/');
}

function cmsNewsSlugValidationError(
    normalizedSlug: string,
    contentKind: CmsPageContentKind,
) {
    const segments = normalizedSlug.split('/').filter(Boolean);

    if (contentKind === 'blog') {
        if (segments[0] !== 'novosti' || segments.length < 2) {
            return 'Blog page slug must use /novosti/<slug>.';
        }

        if (segments[1] === 'sto-je-novo') {
            return 'Blog page slug conflicts with the changelog route: /novosti/sto-je-novo.';
        }
    }

    if (contentKind === 'changelog') {
        if (
            segments[0] !== 'novosti' ||
            segments[1] !== 'sto-je-novo' ||
            segments.length < 3
        ) {
            return 'Changelog page slug must use /novosti/sto-je-novo/<slug>.';
        }
    }

    return null;
}

export function getCmsPageSlugValidationError(
    slug: string,
    options: { contentKind?: CmsPageContentKind | string | null } = {},
) {
    const normalizedSlug = normalizeCmsPageSlug(slug);
    if (!normalizedSlug) {
        return 'Page slug is required.';
    }

    const contentKind = normalizeCmsPageContentKind(options.contentKind);
    const newsSlugError = cmsNewsSlugValidationError(
        normalizedSlug,
        contentKind,
    );
    if (newsSlugError) {
        return newsSlugError;
    }

    const firstSegment = normalizedSlug.split('/')[0];
    if (
        contentKind === 'page' &&
        firstSegment &&
        reservedCmsPageFirstSegments.has(firstSegment.toLowerCase())
    ) {
        return `Page slug conflicts with a reserved route: /${firstSegment}.`;
    }

    return null;
}

async function assertCmsPageSlugIsValid(
    slug: string,
    pageId?: number,
    contentKind?: CmsPageContentKind | string | null,
) {
    const validationError = getCmsPageSlugValidationError(slug, {
        contentKind,
    });
    if (validationError) {
        throw new Error(validationError);
    }

    const existing = await storage().query.cmsPages.findFirst({
        where: pageId
            ? and(
                  eq(cmsPages.slug, slug),
                  eq(cmsPages.isDeleted, false),
                  ne(cmsPages.id, pageId),
              )
            : and(eq(cmsPages.slug, slug), eq(cmsPages.isDeleted, false)),
    });

    if (existing) {
        throw new Error(`Page slug already exists: /${slug}.`);
    }
}

function pageInsertValues(input: CreateCmsPageInput): InsertCmsPage {
    const state = input.state ?? 'draft';
    const title = requiredText(input.title, 'Page title');
    const contentKind = normalizeCmsPageContentKind(input.contentKind);
    const publishedAt = optionalDate(input.publishedAt, 'Published date');

    const values: InsertCmsPage = {
        slug: normalizeCmsPageSlug(input.slug),
        title,
        content: normalizeCmsPageContent(input.content),
        contentKind,
        category: optionalTaxonomyText(input.category),
        tags: normalizeCmsPageTags(input.tags),
        state,
        publishedAt:
            state === 'published' ? (publishedAt ?? new Date()) : publishedAt,
        metaTitle: optionalText(input.metaTitle),
        metaDescription: boundedOptionalText(
            input.metaDescription,
            'Meta description',
            160,
        ),
        metaImageUrl: optionalText(input.metaImageUrl),
        seoImageUrl: optionalText(input.seoImageUrl),
        canonicalPath: optionalText(input.canonicalPath),
        noIndex: input.noIndex ?? false,
    };

    if (state === 'in-review' || state === 'published') {
        assertCmsPagePublishReadiness(values);
    }

    return values;
}

const normalizeCmsPageContent = normalizeCmsPageContentPayload;

function normalizeCmsPageContentForUpdate(
    content: string | null | undefined,
    existingContent: string | null | undefined,
) {
    const normalized = optionalText(content);
    const normalizedExisting = optionalText(existingContent);

    if (normalized === normalizedExisting) {
        return normalizedExisting;
    }

    return normalizeCmsPageContent(content);
}

function assertCmsPagePublishReadiness(input: {
    slug: string;
    contentKind?: string | null;
    content?: string | null;
    category?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
}) {
    const issues: string[] = [];
    const contentKind = normalizeCmsPageContentKind(input.contentKind);

    const slugError = getCmsPageSlugValidationError(input.slug, {
        contentKind,
    });
    if (slugError) {
        issues.push(slugError);
    }

    if (!input.content) {
        issues.push('Page content is required before publishing.');
    }

    if (!input.metaTitle) {
        issues.push('Meta title is required before publishing.');
    }

    if (!input.metaDescription) {
        issues.push('Meta description is required before publishing.');
    }

    if (contentKind === 'blog' && !input.category) {
        issues.push('Blog category is required before publishing.');
    }

    if (issues.length > 0) {
        throw new Error(
            `Page is not ready for publishing. ${issues.join(' ')}`,
        );
    }
}

export async function getCmsPages(options: GetCmsPagesOptions = {}) {
    const where = options.includeDeleted
        ? options.state
            ? eq(cmsPages.state, options.state)
            : undefined
        : options.state
          ? and(
                eq(cmsPages.isDeleted, false),
                eq(cmsPages.state, options.state),
            )
          : eq(cmsPages.isDeleted, false);

    const query = async () => {
        const baseQuery = storage()
            .select()
            .from(cmsPages)
            .orderBy(desc(cmsPages.updatedAt), desc(cmsPages.id));

        return where ? baseQuery.where(where) : baseQuery;
    };

    if (options.includeDeleted) {
        return query();
    }

    const stateKey = options.state ?? 'all';
    return directoriesCached(cacheKeys.cmsPagesList(stateKey), query, 300);
}

function newsPagePublicWhere(options: GetPublishedCmsNewsPagesOptions = {}) {
    const filters = [
        eq(cmsPages.isDeleted, false),
        eq(cmsPages.state, 'published'),
    ];
    const category = lowerTaxonomyValue(options.category);
    const tag = lowerTaxonomyValue(options.tag);

    if (options.contentKind) {
        filters.push(eq(cmsPages.contentKind, options.contentKind));
    } else {
        filters.push(ne(cmsPages.contentKind, 'page'));
    }

    if (options.publishedAfter) {
        filters.push(gt(cmsPages.publishedAt, options.publishedAfter));
    }

    if (category) {
        filters.push(sql`lower(${cmsPages.category}) = ${category}`);
    }

    if (tag) {
        filters.push(sql`exists (
            select 1
            from unnest(${cmsPages.tags}) as cms_page_tag(value)
            where lower(cms_page_tag.value) = ${tag}
        )`);
    }

    return and(...filters);
}

export async function getPublishedCmsNewsPages(
    options: GetPublishedCmsNewsPagesOptions = {},
) {
    const limit = Math.max(1, Math.min(options.limit ?? 100, 100));
    const rows = await storage()
        .select()
        .from(cmsPages)
        .where(newsPagePublicWhere(options))
        .orderBy(desc(cmsPages.publishedAt), desc(cmsPages.id))
        .limit(limit);

    return rows;
}

export function getCmsPage(id: number) {
    return storage().query.cmsPages.findFirst({
        where: and(eq(cmsPages.id, id), eq(cmsPages.isDeleted, false)),
    });
}

export function getCmsPageBySlug(slug: string) {
    const normalizedSlug = normalizeCmsPageSlug(slug);
    return directoriesCached(
        cacheKeys.cmsPageBySlug(normalizedSlug),
        () =>
            storage().query.cmsPages.findFirst({
                where: and(
                    eq(cmsPages.slug, normalizedSlug),
                    eq(cmsPages.isDeleted, false),
                ),
            }),
        300,
    );
}

export function cmsPageCacheKeysForSlug(slug: string) {
    const normalizedSlug = normalizeCmsPageSlug(slug);
    return [
        cacheKeys.cmsPageBySlug(normalizedSlug),
        cacheKeys.cmsPagesList('all'),
        cacheKeys.cmsPagesList('draft'),
        cacheKeys.cmsPagesList('in-review'),
        cacheKeys.cmsPagesList('published'),
    ];
}

async function bustCmsPageCaches(slugs: string[]) {
    const keys = new Set<string>();
    for (const slug of slugs) {
        for (const key of cmsPageCacheKeysForSlug(slug)) {
            keys.add(key);
        }
    }

    await Promise.all(Array.from(keys, (key) => bustCached(key)));
}

export async function createCmsPage(
    input: CreateCmsPageInput,
    actor?: CmsActor,
) {
    const values = pageInsertValues(input);
    await assertCmsPageSlugIsValid(values.slug, undefined, values.contentKind);

    const [created] = await storage()
        .insert(cmsPages)
        .values(values)
        .returning({ id: cmsPages.id });

    if (!created) {
        throw new Error('Failed to create CMS page.');
    }
    await storage().insert(cmsPageRevisions).values({
        cmsPageId: created.id,
        action: 'cms_page.created',
        actorId: actor?.id,
        actorName: actor?.name,
        nextSlug: values.slug,
        nextTitle: values.title,
        nextContent: values.content,
        nextContentKind: values.contentKind,
        nextCategory: values.category,
        nextTags: values.tags,
        nextState: values.state,
        nextMetaTitle: values.metaTitle,
        nextMetaDescription: values.metaDescription,
        nextMetaImageUrl: values.metaImageUrl,
        nextSeoImageUrl: values.seoImageUrl,
        nextCanonicalPath: values.canonicalPath,
        nextNoIndex: values.noIndex,
        nextPublishedAt: values.publishedAt,
    });

    await bustCmsPageCaches([values.slug]);

    return created.id;
}

export async function updateCmsPage(
    input: UpdateCmsPageInput,
    actor?: CmsActor,
) {
    const existing = await getCmsPage(input.id);
    if (!existing) {
        throw new Error(`CMS page with id ${input.id} not found.`);
    }

    const updateData: Partial<InsertCmsPage> = {};

    if (input.slug !== undefined) {
        const slug = normalizeCmsPageSlug(input.slug);
        await assertCmsPageSlugIsValid(
            slug,
            input.id,
            normalizeCmsPageContentKind(
                input.contentKind ?? existing.contentKind,
            ),
        );
        updateData.slug = slug;
    }

    if (input.title !== undefined) {
        updateData.title = requiredText(input.title, 'Page title');
    }

    if (input.content !== undefined) {
        updateData.content = normalizeCmsPageContentForUpdate(
            input.content,
            existing.content,
        );
    }

    if (input.contentKind !== undefined) {
        updateData.contentKind = normalizeCmsPageContentKind(input.contentKind);
        await assertCmsPageSlugIsValid(
            updateData.slug ?? existing.slug,
            input.id,
            updateData.contentKind,
        );
    }

    if (input.category !== undefined) {
        updateData.category = optionalTaxonomyText(input.category);
    }

    if (input.tags !== undefined) {
        updateData.tags = normalizeCmsPageTags(input.tags);
    }

    if (input.metaTitle !== undefined) {
        updateData.metaTitle = optionalText(input.metaTitle);
    }

    if (input.metaDescription !== undefined) {
        updateData.metaDescription = boundedOptionalText(
            input.metaDescription,
            'Meta description',
            160,
        );
    }

    if (input.metaImageUrl !== undefined) {
        updateData.metaImageUrl = optionalText(input.metaImageUrl);
    }

    if (input.seoImageUrl !== undefined) {
        updateData.seoImageUrl = optionalText(input.seoImageUrl);
    }

    if (input.canonicalPath !== undefined) {
        updateData.canonicalPath = optionalText(input.canonicalPath);
    }

    if (input.noIndex !== undefined) {
        updateData.noIndex = input.noIndex;
    }

    if (input.publishedAt !== undefined) {
        updateData.publishedAt = optionalDate(
            input.publishedAt,
            'Published date',
        );
    }

    if (input.state !== undefined) {
        updateData.state = input.state;
        const isMarkingReadyForReview =
            input.state === 'in-review' && existing.state !== 'in-review';
        const isPublishing =
            input.state === 'published' && existing.state !== 'published';

        if (isMarkingReadyForReview || isPublishing) {
            assertCmsPagePublishReadiness({
                slug: updateData.slug ?? existing.slug,
                contentKind: updateData.contentKind ?? existing.contentKind,
                content: updateData.content ?? existing.content,
                category: updateData.category ?? existing.category,
                metaTitle: updateData.metaTitle ?? existing.metaTitle,
                metaDescription:
                    updateData.metaDescription ?? existing.metaDescription,
            });
        }

        if (isPublishing) {
            updateData.publishedAt =
                updateData.publishedAt ?? existing.publishedAt ?? new Date();
        } else if (
            input.state === 'published' &&
            updateData.publishedAt === null
        ) {
            updateData.publishedAt = new Date();
        }
    } else if (
        existing.state === 'published' &&
        updateData.publishedAt === null
    ) {
        updateData.publishedAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
        return;
    }

    await storage()
        .update(cmsPages)
        .set(updateData)
        .where(and(eq(cmsPages.id, input.id), eq(cmsPages.isDeleted, false)));
    const next = await getCmsPage(input.id);
    if (!next) {
        return;
    }

    const action =
        existing.state !== next.state
            ? 'cms_page.state_changed'
            : 'cms_page.updated';
    await storage()
        .insert(cmsPageRevisions)
        .values({
            ...cmsPageRevisionValues(existing, next),
            cmsPageId: input.id,
            action,
            actorId: actor?.id,
            actorName: actor?.name,
        });

    await bustCmsPageCaches([existing.slug, next.slug]);
}

export async function updateCmsPageState(
    id: number,
    state: CmsPageState,
    actor?: CmsActor,
) {
    await updateCmsPage({ id, state }, actor);
}

function cmsPageRevisionValues(
    previous: SelectCmsPage,
    next: SelectCmsPage,
): Omit<InsertCmsPageRevision, 'cmsPageId' | 'action'> {
    return {
        previousSlug: previous.slug,
        nextSlug: next.slug,
        previousTitle: previous.title,
        nextTitle: next.title,
        previousContent: previous.content,
        nextContent: next.content,
        previousContentKind: previous.contentKind,
        nextContentKind: next.contentKind,
        previousCategory: previous.category,
        nextCategory: next.category,
        previousTags: previous.tags,
        nextTags: next.tags,
        previousState: previous.state,
        nextState: next.state,
        previousMetaTitle: previous.metaTitle,
        nextMetaTitle: next.metaTitle,
        previousMetaDescription: previous.metaDescription,
        nextMetaDescription: next.metaDescription,
        previousMetaImageUrl: previous.metaImageUrl,
        nextMetaImageUrl: next.metaImageUrl,
        previousSeoImageUrl: previous.seoImageUrl,
        nextSeoImageUrl: next.seoImageUrl,
        previousCanonicalPath: previous.canonicalPath,
        nextCanonicalPath: next.canonicalPath,
        previousNoIndex: previous.noIndex,
        nextNoIndex: next.noIndex,
        previousPublishedAt: previous.publishedAt,
        nextPublishedAt: next.publishedAt,
    };
}

function cmsPageRevisionState(
    previousState: string | null,
    nextState: string | null,
): CmsPageState {
    const state = previousState ?? nextState;
    return state && isCmsPageState(state) ? state : 'draft';
}

export async function softDeleteCmsPage(id: number, actor?: CmsActor) {
    const existing = await getCmsPage(id);
    if (!existing) {
        throw new Error(`CMS page with id ${id} not found.`);
    }
    if (existing.state === 'published') {
        throw new Error('CMS page must be unpublished before deletion.');
    }

    const [deleted] = await storage()
        .update(cmsPages)
        .set({ isDeleted: true })
        .where(
            and(
                eq(cmsPages.id, id),
                eq(cmsPages.isDeleted, false),
                ne(cmsPages.state, 'published'),
            ),
        )
        .returning({ id: cmsPages.id });
    if (!deleted) {
        throw new Error('CMS page must be unpublished before deletion.');
    }

    await storage()
        .insert(cmsPageRevisions)
        .values({
            ...cmsPageRevisionValues(existing, existing),
            cmsPageId: id,
            action: 'cms_page.deleted',
            actorId: actor?.id,
            actorName: actor?.name,
        });

    await bustCmsPageCaches([existing.slug]);
}

export async function getCmsPageRevisions(cmsPageId: number) {
    return storage().query.cmsPageRevisions.findMany({
        where: eq(cmsPageRevisions.cmsPageId, cmsPageId),
        orderBy: (revisions, { desc }) => [
            desc(revisions.createdAt),
            desc(revisions.id),
        ],
    });
}

export async function restoreCmsPageRevision(
    cmsPageId: number,
    revisionId: number,
    actor?: CmsActor,
) {
    const revision = await storage().query.cmsPageRevisions.findFirst({
        where: and(
            eq(cmsPageRevisions.id, revisionId),
            eq(cmsPageRevisions.cmsPageId, cmsPageId),
        ),
    });
    if (!revision) throw new Error('CMS page revision not found.');
    const restoreNextSnapshot = revision.action === 'cms_page.created';
    await updateCmsPage(
        {
            id: cmsPageId,
            slug: restoreNextSnapshot
                ? (revision.nextSlug ?? '')
                : (revision.previousSlug ?? ''),
            title: restoreNextSnapshot
                ? (revision.nextTitle ?? '')
                : (revision.previousTitle ?? ''),
            content: restoreNextSnapshot
                ? revision.nextContent
                : revision.previousContent,
            contentKind: restoreNextSnapshot
                ? normalizeCmsPageContentKind(revision.nextContentKind)
                : normalizeCmsPageContentKind(revision.previousContentKind),
            category: restoreNextSnapshot
                ? revision.nextCategory
                : revision.previousCategory,
            tags: restoreNextSnapshot
                ? revision.nextTags
                : revision.previousTags,
            state: cmsPageRevisionState(
                restoreNextSnapshot ? null : revision.previousState,
                restoreNextSnapshot ? revision.nextState : null,
            ),
            metaTitle: restoreNextSnapshot
                ? revision.nextMetaTitle
                : revision.previousMetaTitle,
            metaDescription: restoreNextSnapshot
                ? revision.nextMetaDescription
                : revision.previousMetaDescription,
            metaImageUrl: restoreNextSnapshot
                ? revision.nextMetaImageUrl
                : revision.previousMetaImageUrl,
            seoImageUrl: restoreNextSnapshot
                ? revision.nextSeoImageUrl
                : revision.previousSeoImageUrl,
            canonicalPath: restoreNextSnapshot
                ? revision.nextCanonicalPath
                : revision.previousCanonicalPath,
            noIndex:
                (restoreNextSnapshot
                    ? revision.nextNoIndex
                    : revision.previousNoIndex) ?? false,
        },
        actor,
    );
}

export function cmsPagePublicPath(page: Pick<SelectCmsPage, 'slug'>) {
    return `/${page.slug}`;
}
