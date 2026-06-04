'use server';

import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
    type CreateCmsPageInput,
    createCmsPage,
    getCmsPage,
    isCmsPageContentKind,
    isCmsPageState,
    restoreCmsPageRevision,
    softDeleteCmsPage,
    updateCmsPage,
    updateCmsPageState,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

const maxCmsMarkdownImageSizeBytes = 10 * 1024 * 1024;
const cmsMarkdownImageContentTypeExtensions: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

export type CmsPageFormState = {
    success: false;
    message: string;
} | null;

export type CmsPageAutosaveState = {
    success: boolean;
    message: string;
    savedAt?: string;
};

function formText(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
}

function formOptionalText(formData: FormData, key: string) {
    const value = formText(formData, key).trim();
    return value.length > 0 ? value : null;
}

function toCmsImagePathSegment(value: string) {
    const normalized = value
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

    return normalized || 'image';
}

function cmsMarkdownImageFileName(file: File) {
    const trimmedName = file.name.trim();
    const extensionSeparatorIndex = trimmedName.lastIndexOf('.');
    const hasExtension =
        extensionSeparatorIndex > 0 &&
        extensionSeparatorIndex < trimmedName.length - 1;
    const rawName = hasExtension
        ? trimmedName.slice(0, extensionSeparatorIndex)
        : trimmedName;
    const contentTypeExtension =
        cmsMarkdownImageContentTypeExtensions[file.type];

    if (!contentTypeExtension) {
        throw new Error('Podržane su samo AVIF, GIF, JPEG, PNG i WebP slike.');
    }

    return `${toCmsImagePathSegment(rawName)}.${contentTypeExtension}`;
}

function cmsCdnPublicUrl(pathname: string) {
    const { CDN_R2_PUBLIC_URL } = process.env;
    if (!CDN_R2_PUBLIC_URL) {
        throw new Error('CDN konfiguracija nije postavljena.');
    }

    return `${CDN_R2_PUBLIC_URL.replace(/\/+$/u, '')}/${pathname}`;
}

function formCmsPageState(formData: FormData) {
    const value =
        formText(formData, 'publishState') || formText(formData, 'state');
    return isCmsPageState(value) ? value : 'draft';
}

function formCmsPageContentKind(formData: FormData) {
    const value = formText(formData, 'contentKind');
    return isCmsPageContentKind(value) ? value : 'page';
}

function formTags(formData: FormData) {
    return formData
        .getAll('tags')
        .flatMap((value) => (typeof value === 'string' ? value.split(',') : []))
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
}

function cmsPageInputFromForm(formData: FormData): CreateCmsPageInput {
    const title = formText(formData, 'title');
    const slug = formText(formData, 'slug') || title;

    return {
        title,
        slug,
        state: formCmsPageState(formData),
        contentKind: formCmsPageContentKind(formData),
        category: formOptionalText(formData, 'category'),
        tags: formTags(formData),
        content: formOptionalText(formData, 'content'),
        metaTitle: formOptionalText(formData, 'metaTitle'),
        metaDescription: formOptionalText(formData, 'metaDescription'),
        metaImageUrl: formOptionalText(formData, 'metaImageUrl'),
        seoImageUrl: formOptionalText(formData, 'seoImageUrl'),
        canonicalPath: formOptionalText(formData, 'canonicalPath'),
        noIndex: formData.get('noIndex') === 'on',
        publishedAt: formOptionalText(formData, 'publishedAt'),
    };
}

function cmsPageErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return 'Spremanje stranice nije uspjelo.';
}

export async function uploadCmsMarkdownImage(formData: FormData) {
    await auth(['admin']);

    const file = formData.get('file');
    if (!(file instanceof File)) {
        throw new Error('Slika je obavezna.');
    }

    if (file.size <= 0) {
        throw new Error('Slika je prazna.');
    }

    if (file.size > maxCmsMarkdownImageSizeBytes) {
        throw new Error('Slika smije imati najviše 10 MB.');
    }

    const {
        CDN_R2_ACCESS_KEY_ID,
        CDN_R2_SECRET_ACCESS_KEY,
        CDN_R2_BUCKET_NAME,
        CDN_R2_ENDPOINT,
    } = process.env;
    if (
        !CDN_R2_ACCESS_KEY_ID ||
        !CDN_R2_SECRET_ACCESS_KEY ||
        !CDN_R2_BUCKET_NAME ||
        !CDN_R2_ENDPOINT
    ) {
        throw new Error('R2 konfiguracija nije postavljena.');
    }

    const safeFileName = cmsMarkdownImageFileName(file);
    const pathname = `cms/markdown/${randomUUID()}-${safeFileName}`;
    const client = new S3Client({
        region: 'auto',
        endpoint: CDN_R2_ENDPOINT,
        credentials: {
            accessKeyId: CDN_R2_ACCESS_KEY_ID,
            secretAccessKey: CDN_R2_SECRET_ACCESS_KEY,
        },
    });

    await client.send(
        new PutObjectCommand({
            Bucket: CDN_R2_BUCKET_NAME,
            Key: pathname,
            Body: Buffer.from(await file.arrayBuffer()),
            ContentType: file.type,
        }),
    );

    return {
        url: cmsCdnPublicUrl(pathname),
    };
}

function revalidateCmsPagePaths(pageId: number) {
    revalidatePath(KnownPages.CmsPages);
    revalidatePath(KnownPages.CmsPageEdit(pageId));
}

function revalidatePublicCmsPagePaths(slug: string) {
    revalidatePath(`/${slug}`);
    revalidatePath('/api/directories/pages');
    revalidatePath(`/api/directories/pages/${slug}`);
    revalidatePath('/api/news/blog');
    revalidatePath('/api/news/changelog');
    revalidatePath('/novosti');
    revalidatePath('/novosti/sto-je-novo');
}

export async function createCmsPageAction(
    _previousState: CmsPageFormState,
    formData: FormData,
): Promise<CmsPageFormState> {
    const authContext = await auth(['admin']);
    const payload = cmsPageInputFromForm(formData);

    let pageId: number;
    try {
        pageId = await createCmsPage(payload, {
            id: authContext.user.id,
            name: authContext.user.userName,
        });
    } catch (error) {
        return {
            success: false,
            message: cmsPageErrorMessage(error),
        };
    }

    revalidateCmsPagePaths(pageId);
    if (payload.state === 'published') {
        revalidatePublicCmsPagePaths(payload.slug);
    }
    redirect(KnownPages.CmsPageEdit(pageId));
}

export async function updateCmsPageAction(
    pageId: number,
    _previousState: CmsPageFormState,
    formData: FormData,
): Promise<CmsPageFormState> {
    const authContext = await auth(['admin']);

    const payload = cmsPageInputFromForm(formData);
    const existingPage = await getCmsPage(pageId);

    try {
        await updateCmsPage(
            {
                id: pageId,
                ...payload,
            },
            {
                id: authContext.user.id,
                name: authContext.user.userName,
            },
        );
    } catch (error) {
        return {
            success: false,
            message: cmsPageErrorMessage(error),
        };
    }

    revalidateCmsPagePaths(pageId);
    if (payload.state === 'published' || existingPage?.state === 'published') {
        const publicSlugs = [existingPage?.slug, payload.slug].filter(
            (slug): slug is string => Boolean(slug),
        );
        for (const publicSlug of new Set(publicSlugs)) {
            revalidatePublicCmsPagePaths(publicSlug);
        }
    }
    redirect(KnownPages.CmsPageEdit(pageId));
}

export async function autosaveCmsPageAction(
    pageId: number,
    formData: FormData,
): Promise<CmsPageAutosaveState> {
    const authContext = await auth(['admin']);

    const payload = cmsPageInputFromForm(formData);
    const existingPage = await getCmsPage(pageId);

    try {
        await updateCmsPage(
            {
                id: pageId,
                ...payload,
            },
            {
                id: authContext.user.id,
                name: authContext.user.userName,
            },
        );
    } catch (error) {
        return {
            success: false,
            message: cmsPageErrorMessage(error),
        };
    }

    revalidateCmsPagePaths(pageId);
    if (payload.state === 'published' || existingPage?.state === 'published') {
        const publicSlugs = [existingPage?.slug, payload.slug].filter(
            (slug): slug is string => Boolean(slug),
        );
        for (const publicSlug of new Set(publicSlugs)) {
            revalidatePublicCmsPagePaths(publicSlug);
        }
    }
    return {
        success: true,
        message: 'Promjene spremljene.',
        savedAt: new Date().toISOString(),
    };
}

export async function publishCmsPageAction(pageId: number) {
    const authContext = await auth(['admin']);

    let slug = '';

    try {
        const page = await getCmsPage(pageId);
        slug = page?.slug ?? '';
        await updateCmsPageState(pageId, 'published', {
            id: authContext.user.id,
            name: authContext.user.userName,
        });
    } catch (error) {
        const message = encodeURIComponent(cmsPageErrorMessage(error));
        redirect(`${KnownPages.CmsPageEdit(pageId)}?publishError=${message}`);
    }
    revalidateCmsPagePaths(pageId);
    if (slug) {
        revalidatePublicCmsPagePaths(slug);
    }
}

export async function unpublishCmsPageAction(pageId: number) {
    const authContext = await auth(['admin']);
    const page = await getCmsPage(pageId);

    await updateCmsPageState(pageId, 'draft', {
        id: authContext.user.id,
        name: authContext.user.userName,
    });
    revalidateCmsPagePaths(pageId);
    if (page?.slug) {
        revalidatePublicCmsPagePaths(page.slug);
    }
}

export async function deleteCmsPageAction(pageId: number) {
    const authContext = await auth(['admin']);

    await softDeleteCmsPage(pageId, {
        id: authContext.user.id,
        name: authContext.user.userName,
    });
    revalidateCmsPagePaths(pageId);
    redirect(KnownPages.CmsPages);
}

export async function restoreCmsPageRevisionAction(
    pageId: number,
    revisionId: number,
) {
    const authContext = await auth(['admin']);
    await restoreCmsPageRevision(pageId, revisionId, {
        id: authContext.user.id,
        name: authContext.user.userName,
    });
    revalidateCmsPagePaths(pageId);
}
