'use server';

import {
    assertObservationImageMetadata,
    getObservationImagePathPrefix,
    normalizeObservationContent,
    parseObservationSubmissionId,
    parseRaisedBedObservationTarget,
    RaisedBedObservationError,
} from '@gredice/js/operations';
import {
    reserveRaisedBedObservationImage,
    submitRaisedBedObservation,
} from '@gredice/storage';
import { BlobNotFoundError, head } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../lib/auth/auth';

export async function submitRaisedBedObservationAction(formData: FormData) {
    const {
        userId,
        user: { role },
    } = await auth(['farmer', 'admin']);
    try {
        const targetValue = formData.get('target');
        const imagesValue = formData.get('imageUrls');
        if (typeof targetValue !== 'string' || typeof imagesValue !== 'string')
            throw new RaisedBedObservationError(
                'Podaci opažanja nisu valjani.',
            );
        const target = parseRaisedBedObservationTarget(JSON.parse(targetValue));
        const submissionId = parseObservationSubmissionId(
            formData.get('submissionId'),
        );
        const prefix = getObservationImagePathPrefix(
            target.raisedBedId,
            userId,
            submissionId,
        );
        const content = normalizeObservationContent(
            formData.get('notes'),
            JSON.parse(imagesValue),
            prefix,
        );
        await Promise.all(
            content.imageUrls.map(async (url) => {
                try {
                    const metadata = await head(url);
                    assertObservationImageMetadata(url, prefix, metadata);
                } catch (error) {
                    if (error instanceof RaisedBedObservationError) throw error;
                    throw new RaisedBedObservationError(
                        'Fotografija nije dostupna. Pokušaj ponovno.',
                    );
                }
            }),
        );
        const result = await submitRaisedBedObservation({
            actor: { userId, role: role === 'admin' ? 'admin' : 'farmer' },
            target,
            submissionId,
            ...content,
        });
        revalidatePath('/schedule');
        revalidatePath('/');
        revalidatePath(`/raised-beds/${target.raisedBedId}`);
        return {
            success: true,
            message: 'Opažanje je poslano administratorima na odobrenje.',
            operationId: result.operationId,
        };
    } catch (error) {
        if (
            !(error instanceof RaisedBedObservationError) &&
            !(error instanceof SyntaxError)
        )
            console.error('Failed to submit raised-bed observation', {
                userId,
                error,
            });
        return {
            success: false,
            submissionUncertain:
                !(error instanceof RaisedBedObservationError) &&
                !(error instanceof SyntaxError),
            message:
                error instanceof RaisedBedObservationError
                    ? error.message
                    : 'Opažanje nije spremljeno. Pokušaj ponovno.',
        };
    }
}

// A lost upload response must recover the fixed slot rather than create a new
// blob or overwrite evidence. Reservation validates the current actor/target.
export async function recoverRaisedBedObservationImageAction(input: {
    target: unknown;
    submissionId: string;
    pathname: string;
}) {
    const {
        userId,
        user: { role },
    } = await auth(['farmer', 'admin']);
    const target = parseRaisedBedObservationTarget(input.target);
    const submissionId = parseObservationSubmissionId(input.submissionId);
    const pathname = await reserveRaisedBedObservationImage({
        actor: { userId, role: role === 'admin' ? 'admin' : 'farmer' },
        target,
        submissionId,
        pathname: input.pathname,
    });
    let metadata: Awaited<ReturnType<typeof head>>;
    try {
        metadata = await head(pathname);
    } catch (error) {
        if (error instanceof BlobNotFoundError) return null;
        throw error;
    }
    normalizeObservationContent(
        '',
        [metadata.url],
        getObservationImagePathPrefix(target.raisedBedId, userId, submissionId),
    );
    assertObservationImageMetadata(
        metadata.url,
        getObservationImagePathPrefix(target.raisedBedId, userId, submissionId),
        metadata,
    );
    if (metadata.pathname !== pathname)
        throw new RaisedBedObservationError(
            'Fotografija ne odgovara ovom opažanju.',
        );
    return metadata.url;
}
