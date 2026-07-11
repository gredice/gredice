import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import type { EntityStandardized } from '../@types/EntityStandardized';
import { earnSunflowers } from './accountsRepo';
import { getEntityFormatted } from './entitiesRepo';
import { createEvent, knownEvents } from './eventsRepo';
import {
    getMinimumDiaryRescheduleDate,
    isReschedulableFieldPlantStatus,
    isReschedulableOperationStatus,
    startOfUtcDay,
} from './gardenDiaryRescheduleRepo';
import { deleteRaisedBedField, getRaisedBed } from './gardensRepo';
import { createNotification } from './notificationsRepo';
import { getOperationsByIds } from './operationsRepo';
import { getRaisedBedFieldSunflowerRefundAmount } from './shoppingCartRepo';

export type GardenDiaryCancelStatusCode = 400 | 404 | 409;

export class GardenDiaryCancelError extends Error {
    constructor(
        message: string,
        public readonly statusCode: GardenDiaryCancelStatusCode,
    ) {
        super(message);
        this.name = 'GardenDiaryCancelError';
    }
}

const defaultUserCancelReason = 'Korisnik je otkazao.';

function assertScheduledDateCanCancel(
    scheduledDate: Date | undefined,
    referenceDate: Date,
) {
    if (!scheduledDate) {
        throw new GardenDiaryCancelError(
            'Only scheduled future items can be canceled.',
            409,
        );
    }

    if (
        startOfUtcDay(scheduledDate).getTime() <
        getMinimumDiaryRescheduleDate(referenceDate).getTime()
    ) {
        throw new GardenDiaryCancelError(
            'Items scheduled for today or earlier cannot be canceled.',
            409,
        );
    }
}

function calculateSunflowerRefund(price: number | undefined) {
    return typeof price === 'number' && price > 0
        ? Math.round(price * 1000)
        : 0;
}

async function operationBelongsToGarden({
    accountId,
    gardenId,
    operation,
}: {
    accountId: string;
    gardenId: number;
    operation: Awaited<ReturnType<typeof getOperationsByIds>>[number];
}) {
    if (operation.accountId !== accountId) {
        return false;
    }

    if (operation.gardenId === gardenId && !operation.raisedBedId) {
        return true;
    }

    if (!operation.raisedBedId) {
        return operation.gardenId === gardenId;
    }

    const raisedBed = await getRaisedBed(operation.raisedBedId);
    return (
        Boolean(raisedBed) &&
        raisedBed?.accountId === accountId &&
        raisedBed.gardenId === gardenId
    );
}

function buildRaisedBedNotificationLink(
    raisedBedName: string | null | undefined,
    positionIndex: number | null | undefined,
) {
    if (!raisedBedName) {
        return undefined;
    }

    return getRaisedBedCloseupUrl(
        raisedBedName,
        typeof positionIndex === 'number' ? { positionIndex } : undefined,
    );
}

export async function cancelGardenDiaryOperation({
    accountId,
    canceledBy,
    gardenId,
    operationId,
    reason = defaultUserCancelReason,
    referenceDate = new Date(),
}: {
    accountId: string;
    canceledBy: string;
    gardenId: number;
    operationId: number;
    reason?: string;
    referenceDate?: Date;
}) {
    const [operation] = await getOperationsByIds([operationId]);
    if (
        !operation ||
        !(await operationBelongsToGarden({ accountId, gardenId, operation }))
    ) {
        throw new GardenDiaryCancelError('Operation not found.', 404);
    }

    if (!isReschedulableOperationStatus(operation.status)) {
        throw new GardenDiaryCancelError(
            'Completed or canceled operations cannot be canceled.',
            409,
        );
    }

    assertScheduledDateCanCancel(operation.scheduledDate, referenceDate);

    const operationData = await getEntityFormatted<EntityStandardized>(
        operation.entityId,
    );
    const refundAmount = calculateSunflowerRefund(
        operationData?.prices?.perOperation,
    );
    const operationLabel =
        operationData?.information?.label ??
        operationData?.information?.name ??
        `Radnja #${operationId.toString()}`;
    let content = `Radnja **${operationLabel}** je otkazana.`;
    let linkUrl: string | undefined;

    if (operation.raisedBedId) {
        const raisedBed = await getRaisedBed(operation.raisedBedId);
        if (raisedBed) {
            const positionIndex = operation.raisedBedFieldId
                ? raisedBed.fields.find(
                      (field) => field.id === operation.raisedBedFieldId,
                  )?.positionIndex
                : null;

            if (typeof positionIndex === 'number') {
                content = `Radnja **${operationLabel}** na gredici **${raisedBed.name}** za polje **${positionIndex + 1}** je otkazana.`;
            } else {
                content = `Radnja **${operationLabel}** na gredici **${raisedBed.name}** je otkazana.`;
            }

            linkUrl = buildRaisedBedNotificationLink(
                raisedBed.name,
                positionIndex,
            );
        }
    }

    if (refundAmount > 0) {
        content += `\nSredstva su ti vraćena u iznosu od ${refundAmount} 🌻.`;
    }

    await createEvent(
        knownEvents.operations.canceledV1(operationId.toString(), {
            canceledBy,
            reason,
        }),
    );

    await Promise.all([
        refundAmount > 0
            ? earnSunflowers(
                  accountId,
                  refundAmount,
                  `refund:operation:${operationId}`,
              )
            : Promise.resolve(),
        createNotification({
            accountId,
            gardenId: operation.gardenId ?? gardenId,
            raisedBedId: operation.raisedBedId,
            header: 'Radnja je otkazana',
            content,
            linkUrl,
            timestamp: new Date(),
        }),
    ]);

    return {
        operationId,
        refundAmount,
        reason,
    };
}

export async function cancelGardenDiaryRaisedBedField({
    accountId,
    canceledBy,
    gardenId,
    positionIndex,
    raisedBedId,
    reason = defaultUserCancelReason,
    referenceDate = new Date(),
}: {
    accountId: string;
    canceledBy: string;
    gardenId: number;
    positionIndex: number;
    raisedBedId: number;
    reason?: string;
    referenceDate?: Date;
}) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (
        !raisedBed ||
        raisedBed.accountId !== accountId ||
        raisedBed.gardenId !== gardenId
    ) {
        throw new GardenDiaryCancelError('Raised bed not found.', 404);
    }

    if (isRaisedBedAbandoned(raisedBed.status)) {
        throw new GardenDiaryCancelError('Raised bed is abandoned.', 409);
    }

    const field = raisedBed.fields.find(
        (candidate) =>
            candidate.positionIndex === positionIndex && candidate.active,
    );
    if (!field?.plantSortId) {
        throw new GardenDiaryCancelError('Plant field not found.', 404);
    }

    if (!isReschedulableFieldPlantStatus(field.plantStatus)) {
        throw new GardenDiaryCancelError(
            'Only unfinished plant fields can be canceled.',
            409,
        );
    }

    assertScheduledDateCanCancel(field.plantScheduledDate, referenceDate);

    const plantSortData = await getEntityFormatted<EntityStandardized>(
        field.plantSortId,
    );
    const plantName =
        plantSortData?.information?.name ?? `Biljka #${field.plantSortId}`;
    const activePlantCycle = field.plantCycles.find((cycle) => cycle.active);
    const refundAmount = activePlantCycle
        ? await getRaisedBedFieldSunflowerRefundAmount({
              accountId,
              fallbackAmount: calculateSunflowerRefund(
                  plantSortData?.prices?.perPlant ??
                      plantSortData?.information?.plant?.prices?.perPlant,
              ),
              plantCycleStartedAt: activePlantCycle.startedAt,
              positionIndex,
              raisedBedId,
          })
        : 0;
    let content = `Sijanje biljke **${plantName}** na gredici **${raisedBed.name}** za polje **${positionIndex + 1}** je otkazano.`;

    if (refundAmount > 0) {
        content += `\nSredstva su ti vraćena u iznosu od ${refundAmount} 🌻.`;
    }

    await Promise.all([
        createEvent(
            knownEvents.raisedBedFields.deletedV1(
                `${raisedBedId.toString()}|${positionIndex.toString()}`,
                {
                    canceledBy,
                    reason,
                },
            ),
        ),
        deleteRaisedBedField(raisedBedId, positionIndex, {
            preserveHistory: true,
        }),
        refundAmount > 0
            ? earnSunflowers(
                  accountId,
                  refundAmount,
                  `refund:raisedBedField:${raisedBedId}:${positionIndex}`,
              )
            : Promise.resolve(),
        createNotification({
            accountId,
            gardenId,
            raisedBedId,
            header: 'Sijanje je otkazano',
            content,
            linkUrl: buildRaisedBedNotificationLink(
                raisedBed.name,
                positionIndex,
            ),
            timestamp: new Date(),
        }),
    ]);

    return {
        canceledBy,
        positionIndex,
        raisedBedId,
        refundAmount,
        reason,
    };
}
