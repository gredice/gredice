import {
    MAX_OBSERVATION_IMAGE_SIZE,
    parseObservationSubmissionId,
    parseRaisedBedObservationTarget,
    RaisedBedObservationError,
} from '@gredice/js/operations';
import { reserveRaisedBedObservationImage } from '@gredice/storage';
import { handleUpload } from '@vercel/blob/client';
import { withAuth } from '../../../../../../lib/auth/auth';

export async function POST(request: Request) {
    return withAuth(['farmer', 'admin'], async ({ user, userId }) => {
        try {
            const body = await request.json();
            const result = await handleUpload({
                request,
                body,
                onBeforeGenerateToken: async (pathname, payload) => {
                    const parsed: unknown = JSON.parse(payload ?? 'null');
                    if (
                        !parsed ||
                        typeof parsed !== 'object' ||
                        !('target' in parsed) ||
                        !('submissionId' in parsed)
                    )
                        throw new RaisedBedObservationError(
                            'Podaci fotografije nisu valjani.',
                        );
                    const target = parseRaisedBedObservationTarget(
                        parsed.target,
                    );
                    const submissionId = parseObservationSubmissionId(
                        parsed.submissionId,
                    );
                    await reserveRaisedBedObservationImage({
                        actor: {
                            userId,
                            role: user.role === 'admin' ? 'admin' : 'farmer',
                        },
                        target,
                        submissionId,
                        pathname,
                    });
                    return {
                        allowedContentTypes: ['image/*'],
                        maximumSizeInBytes: MAX_OBSERVATION_IMAGE_SIZE,
                        addRandomSuffix: false,
                        allowOverwrite: false,
                    };
                },
            });
            return Response.json(result);
        } catch (error) {
            return Response.json(
                {
                    error:
                        error instanceof RaisedBedObservationError
                            ? error.message
                            : 'Fotografija nije učitana. Pokušaj ponovno.',
                },
                { status: 400 },
            );
        }
    });
}
