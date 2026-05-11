'use server';

import {
    type CreateCmsPageInput,
    createCmsPage,
    getCmsPage,
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

function formCmsPageState(formData: FormData) {
    const value = formText(formData, 'state');
    return isCmsPageState(value) ? value : 'draft';
}

function cmsPageInputFromForm(formData: FormData): CreateCmsPageInput {
    const title = formText(formData, 'title');
    const slug = formText(formData, 'slug') || title;

    return {
        title,
        slug,
        state: formCmsPageState(formData),
        content: formOptionalText(formData, 'content'),
        metaTitle: formOptionalText(formData, 'metaTitle'),
        metaDescription: formOptionalText(formData, 'metaDescription'),
        metaImageUrl: formOptionalText(formData, 'metaImageUrl'),
        canonicalPath: formOptionalText(formData, 'canonicalPath'),
        noIndex: formData.get('noIndex') === 'on',
    };
}

function cmsPageErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return 'Spremanje stranice nije uspjelo.';
}

function revalidateCmsPagePaths(pageId: number) {
    revalidatePath(KnownPages.CmsPages);
    revalidatePath(KnownPages.CmsPage(pageId));
    revalidatePath(KnownPages.CmsPageEdit(pageId));
}

function revalidatePublicCmsPagePaths(slug: string) {
    revalidatePath(`/${slug}`);
    revalidatePath('/api/directories/pages');
    revalidatePath(`/api/directories/pages/${slug}`);
}

export async function createCmsPageAction(
    _previousState: CmsPageFormState,
    formData: FormData,
): Promise<CmsPageFormState> {
    const authContext = await auth(['admin']);

    let pageId: number;
    try {
        pageId = await createCmsPage(cmsPageInputFromForm(formData), {
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
    redirect(KnownPages.CmsPage(pageId));
}

export async function updateCmsPageAction(
    pageId: number,
    _previousState: CmsPageFormState,
    formData: FormData,
): Promise<CmsPageFormState> {
    const authContext = await auth(['admin']);

    const payload = cmsPageInputFromForm(formData);

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
    if (payload.state === 'published') {
        revalidatePublicCmsPagePaths(payload.slug);
    }
    redirect(KnownPages.CmsPage(pageId));
}

export async function autosaveCmsPageAction(
    pageId: number,
    formData: FormData,
): Promise<CmsPageAutosaveState> {
    const authContext = await auth(['admin']);

    const payload = cmsPageInputFromForm(formData);
    payload.state = 'draft';

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
    return {
        success: true,
        message: 'Skica spremljena.',
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
        redirect(`${KnownPages.CmsPage(pageId)}?publishError=${message}`);
    }
    revalidateCmsPagePaths(pageId);
    if (slug) {
        revalidatePublicCmsPagePaths(slug);
    }
}

export async function unpublishCmsPageAction(pageId: number) {
    const authContext = await auth(['admin']);

    await updateCmsPageState(pageId, 'draft', {
        id: authContext.user.id,
        name: authContext.user.userName,
    });
    revalidateCmsPagePaths(pageId);
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
