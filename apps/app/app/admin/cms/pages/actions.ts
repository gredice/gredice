'use server';

import {
    type CreateCmsPageInput,
    createCmsPage,
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

    try {
        await updateCmsPage(
            {
                id: pageId,
                ...cmsPageInputFromForm(formData),
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
    redirect(KnownPages.CmsPage(pageId));
}

export async function publishCmsPageAction(pageId: number) {
    const authContext = await auth(['admin']);

    try {
        await updateCmsPageState(pageId, 'published', {
            id: authContext.user.id,
            name: authContext.user.userName,
        });
    } catch (error) {
        const message = encodeURIComponent(cmsPageErrorMessage(error));
        redirect(`${KnownPages.CmsPage(pageId)}?publishError=${message}`);
    }
    revalidateCmsPagePaths(pageId);
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
