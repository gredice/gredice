import { getOperationById } from '@gredice/storage';
import { handleUpload } from '@vercel/blob/client';
import { withAuth } from '../../../../../lib/auth/auth';

const MAX_OPERATION_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

function getOperationIdFromClientPayload(clientPayload: string | null) {
    if (!clientPayload) {
        throw new Error('Operation upload payload is required');
    }

    let parsedPayload: unknown;
    try {
        parsedPayload = JSON.parse(clientPayload);
    } catch {
        throw new Error('Invalid operation upload payload');
    }

    if (!parsedPayload || typeof parsedPayload !== 'object') {
        throw new Error('Invalid operation upload payload');
    }

    const operationId = Reflect.get(parsedPayload, 'operationId');
    if (
        typeof operationId !== 'number' ||
        !Number.isInteger(operationId) ||
        operationId <= 0
    ) {
        throw new Error('Invalid operation upload payload');
    }

    return operationId;
}

function getOperationPathPrefix(operationId: number) {
    return `operations/${operationId}/`;
}

export async function POST(request: Request) {
    return await withAuth(['admin'], async () => {
        try {
            const body = await request.json();
            const json = await handleUpload({
                request,
                body,
                onBeforeGenerateToken: async (pathname, clientPayload) => {
                    const operationId =
                        getOperationIdFromClientPayload(clientPayload);
                    const operation = await getOperationById(operationId);
                    if (!operation) {
                        throw new Error('Operation not found');
                    }

                    if (
                        !pathname.startsWith(
                            getOperationPathPrefix(operationId),
                        )
                    ) {
                        throw new Error('Invalid upload path');
                    }

                    return {
                        allowedContentTypes: ['image/*'],
                        maximumSizeInBytes: MAX_OPERATION_IMAGE_SIZE_BYTES,
                        tokenPayload: clientPayload,
                    };
                },
            });

            return Response.json(json);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to prepare image upload';

            return Response.json({ error: message }, { status: 400 });
        }
    });
}
