import { getOutletOffer } from '@gredice/storage';
import { handleUpload } from '@vercel/blob/client';
import { withAuth } from '../../../../../lib/auth/auth';

const MAX_OUTLET_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

type OutletImageUploadPayload = {
    offerId: number | null;
};

function getOutletImageUploadPayload(clientPayload: string | null) {
    if (!clientPayload) {
        throw new Error('Outlet image upload payload is required');
    }

    let parsedPayload: unknown;
    try {
        parsedPayload = JSON.parse(clientPayload);
    } catch {
        throw new Error('Invalid outlet image upload payload');
    }

    if (!parsedPayload || typeof parsedPayload !== 'object') {
        throw new Error('Invalid outlet image upload payload');
    }

    const offerId = Reflect.get(parsedPayload, 'offerId');
    if (offerId === null || offerId === undefined) {
        return {
            offerId: null,
        } satisfies OutletImageUploadPayload;
    }

    if (
        typeof offerId !== 'number' ||
        !Number.isInteger(offerId) ||
        offerId <= 0
    ) {
        throw new Error('Invalid outlet offer id');
    }

    return {
        offerId,
    } satisfies OutletImageUploadPayload;
}

function getOutletImageUploadPathPrefix(payload: OutletImageUploadPayload) {
    const offerSegment = payload.offerId ? String(payload.offerId) : 'draft';
    return `outlet/offers/${offerSegment}/images/`;
}

function validateUploadPath(
    pathname: string,
    payload: OutletImageUploadPayload,
) {
    if (pathname.includes('..') || pathname.includes('\\')) {
        throw new Error('Invalid upload path');
    }

    if (!pathname.startsWith(getOutletImageUploadPathPrefix(payload))) {
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
                    const payload = getOutletImageUploadPayload(clientPayload);
                    if (payload.offerId) {
                        const offer = await getOutletOffer(payload.offerId);
                        if (!offer) {
                            throw new Error('Outlet offer not found');
                        }
                    }

                    validateUploadPath(pathname, payload);

                    return {
                        allowedContentTypes: ['image/*'],
                        maximumSizeInBytes: MAX_OUTLET_IMAGE_SIZE_BYTES,
                        tokenPayload: clientPayload,
                    };
                },
            });

            return Response.json(json);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to prepare outlet image upload';

            return Response.json({ error: message }, { status: 400 });
        }
    });
}
