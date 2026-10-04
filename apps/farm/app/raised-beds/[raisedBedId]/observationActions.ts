'use server';

import {
    assertObservationImageMetadata,
    getObservationImagePathPrefix,
    normalizeObservationContent,
    parseObservationSubmissionId,
    parseRaisedBedObservationTarget,
    RaisedBedObservationError,
} from '@gredice/js/operations';
import { submitRaisedBedObservation } from '@gredice/storage';
import { head } from '@vercel/blob';
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
            message:
                error instanceof RaisedBedObservationError
                    ? error.message
                    : 'Opažanje nije spremljeno. Pokušaj ponovno.',
        };
    }
}
