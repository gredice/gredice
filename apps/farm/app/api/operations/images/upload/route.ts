import { handleUpload } from '@vercel/blob/client';
import { withAuth } from '../../../../../lib/auth/auth';
import { getFarmOperationCompletionImagePathPrefix } from '../../../../schedule/operationCompletionProof';
import { parseScheduleOperationCompletionRequirementsFingerprint } from '../../../../schedule/scheduleOperationRequirements';
import {
    assertNonNegativeSafeInteger,
    assertPositiveSafeInteger,
} from '../../../../schedule/scheduleTaskInput';
import {
    assertScheduleTaskUploadTarget,
    ScheduleTaskUploadTargetError,
    validateScheduleOperationUploadTarget,
} from '../../../../schedule/scheduleTaskUploadValidation';

const MAX_OPERATION_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

function getOperationTargetFromClientPayload(clientPayload: string | null) {
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

    return {
        expectedEntityId: assertPositiveSafeInteger(
            Reflect.get(parsedPayload, 'expectedEntityId'),
            'Invalid operation upload payload',
        ),
        expectedRequirementsFingerprint:
            parseScheduleOperationCompletionRequirementsFingerprint(
                Reflect.get(parsedPayload, 'expectedRequirementsFingerprint'),
            ),
        expectedTaskVersionEventId: assertNonNegativeSafeInteger(
            Reflect.get(parsedPayload, 'expectedTaskVersionEventId'),
            'Invalid operation upload payload',
        ),
        operationId: assertPositiveSafeInteger(
            Reflect.get(parsedPayload, 'operationId'),
            'Invalid operation upload payload',
        ),
    };
}

export async function POST(request: Request) {
    return await withAuth(['farmer', 'admin'], async ({ user, userId }) => {
        try {
            const body = await request.json();
            const json = await handleUpload({
                request,
                body,
                onBeforeGenerateToken: async (pathname, clientPayload) => {
                    const {
                        expectedEntityId,
                        expectedRequirementsFingerprint,
                        expectedTaskVersionEventId,
                        operationId,
                    } = getOperationTargetFromClientPayload(clientPayload);
                    assertScheduleTaskUploadTarget(
                        await validateScheduleOperationUploadTarget({
                            actor: { role: user.role, userId },
                            expectedEntityId,
                            expectedRequirementsFingerprint,
                            expectedTaskVersionEventId,
                            operationId,
                            purpose: 'completion',
                        }),
                    );

                    if (
                        !pathname.startsWith(
                            getFarmOperationCompletionImagePathPrefix(
                                operationId,
                                expectedEntityId,
                                expectedTaskVersionEventId,
                            ),
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
            if (error instanceof ScheduleTaskUploadTargetError) {
                return Response.json(
                    {
                        canRetry: error.canRetry,
                        code: error.code,
                        error: error.message,
                    },
                    { status: 409 },
                );
            }
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to prepare image upload';

            return Response.json(
                {
                    canRetry: false,
                    code: 'invalid_input',
                    error: message,
                },
                { status: 400 },
            );
        }
    });
}
