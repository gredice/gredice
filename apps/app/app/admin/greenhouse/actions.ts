'use server';

import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import { createOperation, getOperations, getRaisedBed } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID } from './constants';
import {
    getSeedlingTransplantingOperationTimestamp,
    isOperationInActivePlantCycle,
} from './operationMatching';

function revalidateGreenhouseOperationPaths(raisedBed: {
    id: number;
    accountId?: string | null;
    farmId?: number | null;
    gardenId?: number | null;
}) {
    revalidatePath(KnownPages.Greenhouse);
    revalidatePath(KnownPages.Schedule);
    revalidatePath(KnownPages.Operations);
    if (raisedBed.accountId) {
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    }
    if (raisedBed.farmId) {
        revalidatePath(KnownPages.Farm(raisedBed.farmId));
    }
    if (raisedBed.gardenId) {
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    }
    revalidatePath(KnownPages.RaisedBed(raisedBed.id));
}

export async function createSeedlingTransplantingOperationAction({
    raisedBedId,
    positionIndex,
}: {
    raisedBedId: number;
    positionIndex: number;
}) {
    await auth(['admin']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }
    if (isRaisedBedAbandoned(raisedBed.status)) {
        throw new Error(
            `${RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE} ${RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}`,
        );
    }
    if (!raisedBed.accountId) {
        throw new Error('Gredica nema povezan korisnički račun.');
    }

    const field = raisedBed.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );
    if (!field) {
        throw new Error('Polje gredice nije pronađeno.');
    }
    if (
        field.plantStatus !== 'sprouted' &&
        field.plantStatus !== 'readyForTransplanting'
    ) {
        throw new Error(
            'Radnja presađivanja može se kreirati samo za proklijale biljke ili biljke spremne za presađivanje.',
        );
    }

    const existingOperation = (
        await getOperations(
            raisedBed.accountId,
            raisedBed.gardenId ?? undefined,
            raisedBed.id,
            [field.id],
        )
    ).find(
        (operation) =>
            operation.entityTypeName === 'operation' &&
            operation.entityId === SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID &&
            isOperationInActivePlantCycle(operation, field),
    );

    if (existingOperation) {
        return {
            success: true,
            alreadyExists: true,
            operationId: existingOperation.id,
        };
    }

    const operationId = await createOperation({
        entityId: SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID,
        entityTypeName: 'operation',
        accountId: raisedBed.accountId,
        gardenId: raisedBed.gardenId ?? undefined,
        raisedBedId: raisedBed.id,
        raisedBedFieldId: field.id,
        timestamp: getSeedlingTransplantingOperationTimestamp(field),
    });

    revalidateGreenhouseOperationPaths(raisedBed);

    return {
        success: true,
        alreadyExists: false,
        operationId,
    };
}
