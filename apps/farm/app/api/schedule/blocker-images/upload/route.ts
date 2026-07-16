import { handleUpload } from '@vercel/blob/client';
import { withAuth } from '../../../../../lib/auth/auth';
import { parseScheduleTaskBlockerTarget } from '../../../../schedule/scheduleTaskBlocker';
import { getScheduleTaskBlockerImagePathPrefix } from '../../../../schedule/scheduleTaskBlockerProof';
import {
    assertScheduleTaskUploadTarget,
    ScheduleTaskUploadTargetError,
    validateScheduleTaskBlockerUploadTarget,
} from '../../../../schedule/scheduleTaskUploadValidation';

const MAX_BLOCKER_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

function getTargetFromClientPayload(clientPayload: string | null) {
    if (!clientPayload) {
        throw new Error('Blocker upload payload is required');
    }

    let parsedPayload: unknown;
    try {
        parsedPayload = JSON.parse(clientPayload);
    } catch {
        throw new Error('Invalid blocker upload payload');
    }

    return parseScheduleTaskBlockerTarget(parsedPayload);
}

export async function POST(request: Request) {
    return await withAuth(['farmer', 'admin'], async ({ user, userId }) => {
        try {
            const body = await request.json();
            const json = await handleUpload({
                request,
                body,
                onBeforeGenerateToken: async (pathname, clientPayload) => {
                    const target = getTargetFromClientPayload(clientPayload);
                    assertScheduleTaskUploadTarget(
                        await validateScheduleTaskBlockerUploadTarget({
                            actor: { role: user.role, userId },
                            target,
                        }),
                    );

                    if (
                        !pathname.startsWith(
                            getScheduleTaskBlockerImagePathPrefix(target),
                        )
                    ) {
                        throw new Error('Invalid upload path');
                    }

                    return {
                        allowedContentTypes: ['image/*'],
                        maximumSizeInBytes: MAX_BLOCKER_IMAGE_SIZE_BYTES,
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
                    : 'Unable to prepare blocker image upload';

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
