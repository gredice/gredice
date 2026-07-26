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
import { raisedBedFieldUpdatePlant } from '../../(actions)/raisedBedFieldsActions';
import { SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID } from './constants';
import {
    getSeedlingTransplantingOperationTimestamp,
    isOperationInActivePlantCycle,
} from './operationMatching';

const sproutedDateActionErrorMessages = new Map([
    ['Invalid plant status timestamp.', 'Odaberi ispravan datum klijanja.'],
    [
        'Biljka se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
        'Biljka se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
    ],
    [
        'Stanje biljke ne može se vratiti na zadatak koji je već dovršen ili blokiran.',
        'Stanje biljke ne može se vratiti na zadatak koji je već dovršen ili blokiran.',
    ],
    [
        'Aktivni životni ciklus biljke nije pronađen.',
        'Aktivni životni ciklus biljke nije pronađen.',
    ],
    [
        'Datum stanja mora biti između zadnjeg datuma životnog ciklusa biljke i današnjeg datuma.',
        'Datum stanja mora biti između zadnjeg datuma životnog ciklusa biljke i današnjeg datuma.',
    ],
]);

function sproutedDateActionErrorMessage(error: unknown) {
    return error instanceof Error
        ? sproutedDateActionErrorMessages.get(error.message)
        : undefined;
}

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

export async function updateGreenhouseSproutedDateAction(input: {
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    positionIndex: number;
    raisedBedId: number;
    timestamp: string;
}) {
    try {
        await raisedBedFieldUpdatePlant({
            ...input,
            status: 'sprouted',
        });
        return { success: true as const };
    } catch (error) {
        const message = sproutedDateActionErrorMessage(error);
        if (message) {
            return { success: false as const, message };
        }

        console.error(
            JSON.stringify({
                level: 'error',
                message: 'Failed to update greenhouse sprouted date',
                error: error instanceof Error ? error.message : String(error),
                positionIndex: input.positionIndex,
                raisedBedId: input.raisedBedId,
            }),
        );

        return {
            success: false as const,
            message: 'Spremanje datuma klijanja nije uspjelo.',
        };
    }
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
    if (field.plantStatus !== 'sprouted') {
        throw new Error(
            'Radnja presađivanja može se kreirati samo za proklijale biljke.',
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
