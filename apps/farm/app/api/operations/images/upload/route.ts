import {
    getFarmUserAcceptedOperationById,
    getOperationById,
} from '@gredice/storage';
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

async function getAuthorizedOperation(
    operationId: number,
    userId: string,
    role: string,
) {
    const operation =
        role === 'admin'
            ? await getOperationById(operationId)
            : await getFarmUserAcceptedOperationById(userId, operationId);

    if (!operation) {
        throw new Error('Operation not found');
    }

    if (
        role !== 'admin' &&
        operation.assignedUserId &&
        operation.assignedUserId !== userId
    ) {
        throw new Error('Ova radnja je dodijeljena drugom korisniku.');
    }

    return operation;
}

export async function POST(request: Request) {
    return await withAuth(['farmer', 'admin'], async ({ user, userId }) => {
        try {
            const body = await request.json();
            const json = await handleUpload({
                request,
                body,
                onBeforeGenerateToken: async (pathname, clientPayload) => {
                    const operationId =
                        getOperationIdFromClientPayload(clientPayload);
                    await getAuthorizedOperation(
                        operationId,
                        userId,
                        user.role,
                    );

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
