import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import { and, eq } from 'drizzle-orm';
import { raisedBeds } from '../schema';
import { createEvent, knownEvents } from './eventsRepo';
import { getRaisedBed } from './gardensRepo';
import { getOperationsByIds, unacceptOperation } from './operationsRepo';
import { getRaisedBedFieldsWithEvents } from './raisedBedFieldsRepo';
import {
    type ScheduleTaskTransaction,
    withOperationScheduleTaskTransaction,
    withPlantingScheduleTaskTransaction,
} from './scheduleTaskSubmissionsRepo';

export type GardenDiaryRescheduleStatusCode = 400 | 404 | 409;

export class GardenDiaryRescheduleError extends Error {
    constructor(
        message: string,
        public readonly statusCode: GardenDiaryRescheduleStatusCode,
    ) {
        super(message);
        this.name = 'GardenDiaryRescheduleError';
    }
}

const terminalOperationStatuses = new Set([
    'pendingVerification',
    'completed',
    'canceled',
]);
const reschedulableFieldPlantStatuses = new Set(['new', 'planned', 'blocked']);
const fieldPlantStatusesThatNeedReconfirmation = new Set(['blocked']);

export function startOfUtcDay(date: Date) {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
}

export function getMinimumDiaryRescheduleDate(referenceDate = new Date()) {
    const tomorrow = startOfUtcDay(referenceDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow;
}

export function isDiaryRescheduleDateAllowed(
    scheduledDate: Date,
    referenceDate = new Date(),
) {
    return (
        startOfUtcDay(scheduledDate).getTime() >=
        getMinimumDiaryRescheduleDate(referenceDate).getTime()
    );
}

export function normalizeDiaryRescheduleDate(
    scheduledDate: string,
    referenceDate = new Date(),
) {
    const parsedDate = new Date(scheduledDate);
    if (Number.isNaN(parsedDate.getTime())) {
        throw new GardenDiaryRescheduleError('Invalid scheduled date.', 400);
    }

    const normalizedDate = startOfUtcDay(parsedDate);
    if (!isDiaryRescheduleDateAllowed(normalizedDate, referenceDate)) {
        throw new GardenDiaryRescheduleError(
            'Scheduled date must be tomorrow or later.',
            400,
        );
    }

    return normalizedDate;
}

export function isReschedulableFieldPlantStatus(status?: string | null) {
    return !status || reschedulableFieldPlantStatuses.has(status);
}

export function isReschedulableOperationStatus(status?: string | null) {
    return !status || !terminalOperationStatuses.has(status);
}

function shouldResetFieldPlantStatusOnReschedule(status?: string | null) {
    return Boolean(
        status && fieldPlantStatusesThatNeedReconfirmation.has(status),
    );
}

function assertExistingScheduledDateCanMove(
    scheduledDate: Date | undefined,
    referenceDate: Date,
) {
    if (!scheduledDate) {
        return;
    }

    if (!isDiaryRescheduleDateAllowed(scheduledDate, referenceDate)) {
        throw new GardenDiaryRescheduleError(
            'Items scheduled for today or earlier cannot be rescheduled.',
            409,
        );
    }
}

async function operationBelongsToGarden({
    accountId,
    gardenId,
    operation,
    transaction,
}: {
    accountId: string;
    gardenId: number;
    operation: Awaited<ReturnType<typeof getOperationsByIds>>[number];
    transaction: ScheduleTaskTransaction;
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

    const raisedBed = await transaction.query.raisedBeds.findFirst({
        columns: { accountId: true, gardenId: true },
        where: and(
            eq(raisedBeds.id, operation.raisedBedId),
            eq(raisedBeds.isDeleted, false),
        ),
    });
    return (
        Boolean(raisedBed) &&
        raisedBed?.accountId === accountId &&
        raisedBed.gardenId === gardenId
    );
}

async function getDiaryRaisedBed(
    raisedBedId: number,
    transaction: ScheduleTaskTransaction,
) {
    const raisedBed = await transaction.query.raisedBeds.findFirst({
        where: and(
            eq(raisedBeds.id, raisedBedId),
            eq(raisedBeds.isDeleted, false),
        ),
    });
    if (!raisedBed) {
        return null;
    }

    return {
        ...raisedBed,
        fields: await getRaisedBedFieldsWithEvents(raisedBedId, transaction),
    };
}

export async function rescheduleGardenDiaryOperation(
    {
        accountId,
        expectedEntityId,
        expectedTaskVersionEventId,
        gardenId,
        operationId,
        scheduledDate,
        referenceDate = new Date(),
    }: {
        accountId: string;
        expectedEntityId: number;
        expectedTaskVersionEventId: number;
        gardenId: number;
        operationId: number;
        scheduledDate: string;
        referenceDate?: Date;
    },
    transaction?: ScheduleTaskTransaction,
) {
    const [expectedOperation] = await getOperationsByIds([operationId]);
    const normalizedDate = normalizeDiaryRescheduleDate(
        scheduledDate,
        referenceDate,
    );

    await withOperationScheduleTaskTransaction(
        operationId,
        async (transaction) => {
            const [operation] = await getOperationsByIds(
                [operationId],
                transaction,
            );
            if (
                !operation ||
                !(await operationBelongsToGarden({
                    accountId,
                    gardenId,
                    operation,
                    transaction,
                }))
            ) {
                throw new GardenDiaryRescheduleError(
                    'Operation not found.',
                    404,
                );
            }

            if (
                operation.entityId !== expectedEntityId ||
                operation.taskVersionEventId !== expectedTaskVersionEventId ||
                (expectedOperation &&
                    operation.status !== expectedOperation.status)
            ) {
                throw new GardenDiaryRescheduleError(
                    'Operation changed while it was being rescheduled.',
                    409,
                );
            }

            if (!isReschedulableOperationStatus(operation.status)) {
                throw new GardenDiaryRescheduleError(
                    'Completed or canceled operations cannot be rescheduled.',
                    409,
                );
            }

            assertExistingScheduledDateCanMove(
                operation.scheduledDate,
                referenceDate,
            );

            await createEvent(
                knownEvents.operations.scheduledV1(operationId.toString(), {
                    scheduledDate: normalizedDate.toISOString(),
                }),
                transaction,
            );
            await unacceptOperation(operationId, transaction);
        },
        transaction,
    );

    return {
        operationId,
        scheduledDate: normalizedDate,
    };
}

export async function rescheduleGardenDiaryRaisedBedField(
    {
        accountId,
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        gardenId,
        raisedBedId,
        positionIndex,
        scheduledDate,
        referenceDate = new Date(),
    }: {
        accountId: string;
        expectedPlantCycleEventId: number;
        expectedPlantCycleVersionEventId: number;
        expectedPlantSortId: number;
        gardenId: number;
        raisedBedId: number;
        positionIndex: number;
        scheduledDate: string;
        referenceDate?: Date;
    },
    transaction?: ScheduleTaskTransaction,
) {
    const expectedRaisedBed = await getRaisedBed(raisedBedId);
    const expectedField = expectedRaisedBed?.fields.find(
        (candidate) =>
            candidate.positionIndex === positionIndex && candidate.active,
    );
    const normalizedDate = normalizeDiaryRescheduleDate(
        scheduledDate,
        referenceDate,
    );

    await withPlantingScheduleTaskTransaction(
        raisedBedId,
        positionIndex,
        async (transaction) => {
            const raisedBed = await getDiaryRaisedBed(raisedBedId, transaction);
            if (
                !raisedBed ||
                raisedBed.accountId !== accountId ||
                raisedBed.gardenId !== gardenId
            ) {
                throw new GardenDiaryRescheduleError(
                    'Raised bed not found.',
                    404,
                );
            }

            if (isRaisedBedAbandoned(raisedBed.status)) {
                throw new GardenDiaryRescheduleError(
                    'Raised bed is abandoned.',
                    409,
                );
            }

            const field = raisedBed.fields.find(
                (candidate) =>
                    candidate.positionIndex === positionIndex &&
                    candidate.active,
            );
            if (!field?.plantSortId) {
                throw new GardenDiaryRescheduleError(
                    'Plant field not found.',
                    404,
                );
            }

            const activePlantCycle = field.plantCycles.find(
                (cycle) => cycle.active,
            );
            if (
                field.plantSortId !== expectedPlantSortId ||
                activePlantCycle?.plantPlaceEventId !==
                    expectedPlantCycleEventId ||
                activePlantCycle?.endedEventId !==
                    expectedPlantCycleVersionEventId ||
                (expectedField &&
                    field.plantStatus !== expectedField.plantStatus)
            ) {
                throw new GardenDiaryRescheduleError(
                    'Plant field changed while it was being rescheduled.',
                    409,
                );
            }

            if (!isReschedulableFieldPlantStatus(field.plantStatus)) {
                throw new GardenDiaryRescheduleError(
                    'Only unfinished plant fields can be rescheduled.',
                    409,
                );
            }

            assertExistingScheduledDateCanMove(
                field.plantScheduledDate,
                referenceDate,
            );

            const aggregateId = `${raisedBedId.toString()}|${positionIndex.toString()}`;
            await createEvent(
                knownEvents.raisedBedFields.plantScheduleV1(aggregateId, {
                    scheduledDate: normalizedDate.toISOString(),
                }),
                transaction,
            );

            if (shouldResetFieldPlantStatusOnReschedule(field.plantStatus)) {
                await createEvent(
                    knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
                        status: 'planned',
                    }),
                    transaction,
                );
            }
        },
        transaction,
    );

    return {
        positionIndex,
        raisedBedId,
        scheduledDate: normalizedDate,
    };
}
