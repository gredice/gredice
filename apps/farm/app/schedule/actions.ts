'use server';

import {
    buildRaisedBedFieldPlantUpdatePayload,
    createEvent,
    getFarmUserAcceptedOperationById,
    getFarmUserRaisedBeds,
    getOperationById,
    getRaisedBed,
    knownEvents,
    queueSeasonalSowingOfferOperations,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';

async function assertFarmerCanCompleteOperation(
    userId: string,
    operationId: number,
) {
    const operation = await getFarmUserAcceptedOperationById(
        userId,
        operationId,
    );
    if (!operation) {
        throw new Error('Nemaš dozvolu za označavanje ove radnje.');
    }

    if (operation.assignedUserId && operation.assignedUserId !== userId) {
        throw new Error('Ova radnja je dodijeljena drugom korisniku.');
    }

    return operation;
}

async function assertFarmerCanCompletePlanting(
    userId: string,
    raisedBedId: number,
    positionIndex: number,
) {
    const raisedBeds = await getFarmUserRaisedBeds(userId);
    const raisedBed = raisedBeds.find((item) => item.id === raisedBedId);
    const field = raisedBed?.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );

    if (!raisedBed || !field) {
        throw new Error('Nemaš dozvolu za označavanje ovog sijanja.');
    }

    if (field.assignedUserId && field.assignedUserId !== userId) {
        throw new Error('Ovo sijanje je dodijeljeno drugom korisniku.');
    }

    return field;
}

function revalidateSchedule() {
    revalidatePath('/schedule');
}

export async function completeFarmOperation(
    operationId: number,
    imageUrls?: string[],
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);

    const operation =
        role === 'admin'
            ? await getOperationById(operationId)
            : await assertFarmerCanCompleteOperation(userId, operationId);

    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }

    if (!operation.isAccepted) {
        throw new Error('Operation must be accepted before completion');
    }

    if (
        operation.status === 'completed' ||
        operation.status === 'pendingVerification'
    ) {
        return { success: true };
    }

    if (operation.status === 'failed' || operation.status === 'canceled') {
        throw new Error(
            `Cannot complete operation with status ${operation.status}`,
        );
    }

    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: userId,
            images: imageUrls,
        }),
    );

    revalidateSchedule();

    return { success: true };
}

export async function completeFarmOperationWithImageUrls(
    operationId: number,
    imageUrls: string[],
) {
    if (!operationId) {
        throw new Error('Operation ID is required');
    }

    return completeFarmOperation(operationId, imageUrls);
}

export async function completeFarmPlanting(
    raisedBedId: number,
    positionIndex: number,
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    const field = raisedBed.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );
    if (!field?.plantSortId) {
        throw new Error('Field or plant sort not found.');
    }

    if (role === 'farmer') {
        await assertFarmerCanCompletePlanting(
            userId,
            raisedBedId,
            positionIndex,
        );
    }

    if (
        field.plantStatus === 'sowed' ||
        field.plantStatus === 'pendingVerification'
    ) {
        return { success: true };
    }

    if (field.plantStatus !== 'planned') {
        throw new Error('Sijanje mora biti potvrđeno prije završetka.');
    }

    const nextStatus = role === 'admin' ? 'sowed' : 'pendingVerification';

    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId}|${positionIndex}`,
            buildRaisedBedFieldPlantUpdatePayload(
                nextStatus,
                field.assignedUserIds,
            ),
        ),
    );

    if (nextStatus === 'sowed' && raisedBed.accountId) {
        await queueSeasonalSowingOfferOperations({
            accountId: raisedBed.accountId,
            raisedBedId,
        });
    }

    revalidateSchedule();

    return { success: true };
}
