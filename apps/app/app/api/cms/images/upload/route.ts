import { getCmsPage } from '@gredice/storage';
import { handleUpload } from '@vercel/blob/client';
import { withAuth } from '../../../../../lib/auth/auth';

const MAX_CMS_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

type CmsImageUploadPayload = {
    pageId: number | null;
    usage: 'cover';
};

function getCmsImageUploadPayload(clientPayload: string | null) {
    if (!clientPayload) {
        throw new Error('CMS image upload payload is required');
    }

    let parsedPayload: unknown;
    try {
        parsedPayload = JSON.parse(clientPayload);
    } catch {
        throw new Error('Invalid CMS image upload payload');
    }

    if (!parsedPayload || typeof parsedPayload !== 'object') {
        throw new Error('Invalid CMS image upload payload');
    }

    const usage = Reflect.get(parsedPayload, 'usage');
    if (usage !== 'cover') {
        throw new Error('Invalid CMS image upload usage');
    }

    const pageId = Reflect.get(parsedPayload, 'pageId');
    if (pageId === null || pageId === undefined) {
        return {
            pageId: null,
            usage,
        } satisfies CmsImageUploadPayload;
    }

    if (
        typeof pageId !== 'number' ||
        !Number.isInteger(pageId) ||
        pageId <= 0
    ) {
        throw new Error('Invalid CMS page id');
    }

    return {
        pageId,
        usage,
    } satisfies CmsImageUploadPayload;
}

function getCmsImageUploadPathPrefix(payload: CmsImageUploadPayload) {
    const pageSegment = payload.pageId ? String(payload.pageId) : 'draft';
    return `cms/pages/${pageSegment}/${payload.usage}/`;
}

function validateUploadPath(pathname: string, payload: CmsImageUploadPayload) {
    if (pathname.includes('..') || pathname.includes('\\')) {
        throw new Error('Invalid upload path');
    }

    if (!pathname.startsWith(getCmsImageUploadPathPrefix(payload))) {
        throw new Error('Invalid upload path');
    }
}

export async function POST(request: Request) {
    return await withAuth(['admin'], async () => {
        try {
            const body = await request.json();
            const json = await handleUpload({
                request,
                body,
                onBeforeGenerateToken: async (pathname, clientPayload) => {
                    const payload = getCmsImageUploadPayload(clientPayload);
                    if (payload.pageId) {
                        const page = await getCmsPage(payload.pageId);
                        if (!page) {
                            throw new Error('CMS page not found');
                        }
                    }

                    validateUploadPath(pathname, payload);

                    return {
                        allowedContentTypes: ['image/*'],
                        maximumSizeInBytes: MAX_CMS_IMAGE_SIZE_BYTES,
                        tokenPayload: clientPayload,
                    };
                },
            });

            return Response.json(json);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to prepare CMS image upload';

            return Response.json({ error: message }, { status: 400 });
        }
    });
}
