'use server';

import {
    buildRaisedBedFieldPlantUpdatePayload,
    createEvent,
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserAcceptedOperationById,
    getFarmUserPrintableHarvestTraceLinkIds,
    getFarmUserRaisedBeds,
    getOperationById,
    getRaisedBed,
    knownEvents,
    markHarvestTraceLinksPrinted,
} from '@gredice/storage';
import { head } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import {
    assertFarmOperationCompletionImagesStored,
    normalizeFarmOperationCompletionImageUrls,
} from './operationCompletionProof';
import {
    assertScheduleOperationCompletionProof,
    assertScheduleOperationCompletionRequirementsAvailable,
    getScheduleOperationCompletionRequirements,
} from './scheduleOperationRequirements';
import {
    assertScheduleOperationTaskAvailableToUser,
    getSchedulePlantingTaskAssignment,
} from './scheduleTaskAssignment';
import {
    assertNonNegativeSafeInteger,
    assertPositiveSafeInteger,
} from './scheduleTaskInput';

const MAX_COMPLETION_NOTES_LENGTH = 2000;

function normalizeCompletionNotes(notes?: string) {
    const normalizedNotes = notes?.trim();
    if (!normalizedNotes) {
        return undefined;
    }

    if (normalizedNotes.length > MAX_COMPLETION_NOTES_LENGTH) {
        throw new Error('Napomena može imati najviše 2000 znakova.');
    }

    return normalizedNotes;
}

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

    assertScheduleOperationTaskAvailableToUser(operation, userId);

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

    if (getSchedulePlantingTaskAssignment(field, userId) === 'other') {
        throw new Error('Ovo sijanje je dodijeljeno drugom korisniku.');
    }

    return field;
}

function revalidateSchedule() {
    revalidatePath('/');
    revalidatePath('/schedule');
}

export async function completeFarmOperation(
    operationId: number,
    imageUrls?: string[],
    notes?: string,
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);
    const validOperationId = assertPositiveSafeInteger(
        operationId,
        'ID radnje nije ispravan.',
    );
    const completionImageUrls = normalizeFarmOperationCompletionImageUrls(
        imageUrls,
        validOperationId,
    );
    const completionNotes = normalizeCompletionNotes(notes);

    const operation =
        role === 'admin'
            ? await getOperationById(validOperationId)
            : await assertFarmerCanCompleteOperation(userId, validOperationId);

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

    const operationDefinitions =
        await getEntitiesFormatted<EntityStandardized>('operation');
    const operationDefinition = operationDefinitions?.find(
        (candidate) => candidate.id === operation.entityId,
    );
    const availableOperationDefinition =
        assertScheduleOperationCompletionRequirementsAvailable(
            operationDefinition,
        );
    assertScheduleOperationCompletionProof(
        getScheduleOperationCompletionRequirements(
            availableOperationDefinition,
        ),
        {
            imageUrls: completionImageUrls,
            notes: completionNotes,
        },
    );
    await assertFarmOperationCompletionImagesStored(
        completionImageUrls,
        validOperationId,
        head,
    );

    await createEvent(
        knownEvents.operations.completedV1(validOperationId.toString(), {
            completedBy: userId,
            images: completionImageUrls,
            notes: completionNotes,
        }),
    );

    revalidateSchedule();

    return { success: true };
}

export async function completeFarmOperationWithImageUrls(
    operationId: number,
    imageUrls: string[],
    notes?: string,
) {
    return completeFarmOperation(operationId, imageUrls, notes);
}

export async function completeFarmPlanting(
    raisedBedId: number,
    positionIndex: number,
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);
    const validRaisedBedId = assertPositiveSafeInteger(
        raisedBedId,
        'ID gredice nije ispravan.',
    );
    const validPositionIndex = assertNonNegativeSafeInteger(
        positionIndex,
        'Pozicija sijanja nije ispravna.',
    );

    const raisedBed = await getRaisedBed(validRaisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${validRaisedBedId} not found.`);
    }

    const field = raisedBed.fields.find(
        (item) => item.positionIndex === validPositionIndex && item.active,
    );
    if (!field?.plantSortId) {
        throw new Error('Field or plant sort not found.');
    }

    if (role === 'farmer') {
        await assertFarmerCanCompletePlanting(
            userId,
            validRaisedBedId,
            validPositionIndex,
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
            `${validRaisedBedId}|${validPositionIndex}`,
            buildRaisedBedFieldPlantUpdatePayload(
                nextStatus,
                field.assignedUserIds,
            ),
        ),
    );

    revalidateSchedule();

    return { success: true };
}

export async function markHarvestTraceLabelsPrintedAction(
    traceLinkIds: number[],
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);

    const printableTraceLinkIds =
        role === 'admin'
            ? traceLinkIds
            : await getFarmUserPrintableHarvestTraceLinkIds(
                  userId,
                  traceLinkIds,
              );

    await markHarvestTraceLinksPrinted(printableTraceLinkIds);
    revalidateSchedule();

    return { success: true };
}
