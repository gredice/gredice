import 'server-only';
import { slugify } from '@gredice/js/slug';
import { and, desc, eq, ne } from 'drizzle-orm';
import { cmsPages, type InsertCmsPage, type SelectCmsPage, storage } from '..';

export type CmsPageState = 'draft' | 'published';

export type CreateCmsPageInput = {
    slug: string;
    title: string;
    content?: string | null;
    state?: CmsPageState;
    metaTitle?: string | null;
    metaDescription?: string | null;
    metaImageUrl?: string | null;
};

export type UpdateCmsPageInput = Partial<CreateCmsPageInput> & {
    id: number;
};

export type GetCmsPagesOptions = {
    state?: CmsPageState;
    includeDeleted?: boolean;
};

const supportedCmsPageSectionComponents = new Set([
    'Heading1',
    'Faq1',
    'Feature1',
    'Footer1',
]);

export function isCmsPageState(value: string): value is CmsPageState {
    return value === 'draft' || value === 'published';
}

const reservedCmsPageFirstSegments = new Set([
    '.well-known',
    '_next',
    'admin',
    'api',
    'biljke',
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
    'o-nama',
    'odjava',
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
    'sjetva',
    'suncokreti',
    'vrtovi',
]);

function optionalText(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function requiredText(value: string, fieldLabel: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${fieldLabel} is required.`);
    }
    return trimmed;
}

function resolveSlugSegments(value: string) {
    return value
        .trim()
        .replace(/[?#].*$/, '')
        .split('/')
        .map((segment) => slugify(segment))
        .filter((segment) => segment.length > 0);
}

export function normalizeCmsPageSlug(value: string) {
    return resolveSlugSegments(value).join('/');
}

export function getCmsPageSlugValidationError(slug: string) {
    const normalizedSlug = normalizeCmsPageSlug(slug);
    if (!normalizedSlug) {
        return 'Page slug is required.';
    }

    const firstSegment = normalizedSlug.split('/')[0];
    if (
        firstSegment &&
        reservedCmsPageFirstSegments.has(firstSegment.toLowerCase())
    ) {
        return `Page slug conflicts with a reserved route: /${firstSegment}.`;
    }

    return null;
}

async function assertCmsPageSlugIsValid(slug: string, pageId?: number) {
    const validationError = getCmsPageSlugValidationError(slug);
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

    return {
        slug: normalizeCmsPageSlug(input.slug),
        title,
        content: normalizeCmsPageContent(input.content),
        state,
        publishedAt: state === 'published' ? new Date() : null,
        metaTitle: optionalText(input.metaTitle),
        metaDescription: optionalText(input.metaDescription),
        metaImageUrl: optionalText(input.metaImageUrl),
    };
}

function normalizeCmsPageContent(content: string | null | undefined) {
    const normalized = optionalText(content);
    if (!normalized) {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(normalized);
    } catch {
        throw new Error(
            'Page content must be a valid JSON array of SectionData blocks.',
        );
    }

    if (!Array.isArray(parsed)) {
        throw new Error(
            'Page content must be a JSON array of SectionData blocks.',
        );
    }

    parsed.forEach((section, index) => {
        if (!section || typeof section !== 'object') {
            throw new Error(
                `Section at index ${index} must be an object with a component field.`,
            );
        }

        if (!('component' in section) || typeof section.component !== 'string') {
            throw new Error(
                `Section at index ${index} must define a string component.`,
            );
        }

        if (!supportedCmsPageSectionComponents.has(section.component)) {
            throw new Error(
                `Section at index ${index} has unsupported component: ${section.component}.`,
            );
        }
    });

    return JSON.stringify(parsed);
}

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

    const query = storage()
        .select()
        .from(cmsPages)
        .orderBy(desc(cmsPages.updatedAt), desc(cmsPages.id));

    return where ? query.where(where) : query;
}

export function getCmsPage(id: number) {
    return storage().query.cmsPages.findFirst({
        where: and(eq(cmsPages.id, id), eq(cmsPages.isDeleted, false)),
    });
}

export function getCmsPageBySlug(slug: string) {
    return storage().query.cmsPages.findFirst({
        where: and(
            eq(cmsPages.slug, normalizeCmsPageSlug(slug)),
            eq(cmsPages.isDeleted, false),
        ),
    });
}

export async function createCmsPage(input: CreateCmsPageInput) {
    const values = pageInsertValues(input);
    await assertCmsPageSlugIsValid(values.slug);

    const [created] = await storage()
        .insert(cmsPages)
        .values(values)
        .returning({ id: cmsPages.id });

    if (!created) {
        throw new Error('Failed to create CMS page.');
    }

    return created.id;
}

export async function updateCmsPage(input: UpdateCmsPageInput) {
    const existing = await getCmsPage(input.id);
    if (!existing) {
        throw new Error(`CMS page with id ${input.id} not found.`);
    }

    const updateData: Partial<InsertCmsPage> = {};

    if (input.slug !== undefined) {
        const slug = normalizeCmsPageSlug(input.slug);
        await assertCmsPageSlugIsValid(slug, input.id);
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

    if (input.state !== undefined) {
        updateData.state = input.state;
        if (input.state === 'published' && existing.state !== 'published') {
            updateData.publishedAt = new Date();
        }
    }

    if (input.metaTitle !== undefined) {
        updateData.metaTitle = optionalText(input.metaTitle);
    }

    if (input.metaDescription !== undefined) {
        updateData.metaDescription = optionalText(input.metaDescription);
    }

    if (input.metaImageUrl !== undefined) {
        updateData.metaImageUrl = optionalText(input.metaImageUrl);
    }

    if (Object.keys(updateData).length === 0) {
        return;
    }

    await storage()
        .update(cmsPages)
        .set(updateData)
        .where(and(eq(cmsPages.id, input.id), eq(cmsPages.isDeleted, false)));
}

export async function updateCmsPageState(id: number, state: CmsPageState) {
    await updateCmsPage({ id, state });
}

export async function softDeleteCmsPage(id: number) {
    const existing = await getCmsPage(id);
    if (!existing) {
        throw new Error(`CMS page with id ${id} not found.`);
    }

    await storage()
        .update(cmsPages)
        .set({ isDeleted: true })
        .where(eq(cmsPages.id, id));
}

export function cmsPagePublicPath(page: Pick<SelectCmsPage, 'slug'>) {
    return `/${page.slug}`;
}
