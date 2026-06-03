import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import { createEvent, knownEvents } from './eventsRepo';
import { getRaisedBed } from './gardensRepo';
import { getOperationsByIds } from './operationsRepo';

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

const reschedulableFieldPlantStatuses = new Set(['new', 'planned']);

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

export async function rescheduleGardenDiaryOperation({
    accountId,
    gardenId,
    operationId,
    scheduledDate,
    referenceDate = new Date(),
}: {
    accountId: string;
    gardenId: number;
    operationId: number;
    scheduledDate: string;
    referenceDate?: Date;
}) {
    const [operation] = await getOperationsByIds([operationId]);
    if (
        !operation ||
        !(await operationBelongsToGarden({ accountId, gardenId, operation }))
    ) {
        throw new GardenDiaryRescheduleError('Operation not found.', 404);
    }

    if (operation.status !== 'planned') {
        throw new GardenDiaryRescheduleError(
            'Only planned operations can be rescheduled.',
            409,
        );
    }

    assertExistingScheduledDateCanMove(operation.scheduledDate, referenceDate);

    const normalizedDate = normalizeDiaryRescheduleDate(
        scheduledDate,
        referenceDate,
    );

    await createEvent(
        knownEvents.operations.scheduledV1(operationId.toString(), {
            scheduledDate: normalizedDate.toISOString(),
        }),
    );

    return {
        operationId,
        scheduledDate: normalizedDate,
    };
}

export async function rescheduleGardenDiaryRaisedBedField({
    accountId,
    gardenId,
    raisedBedId,
    positionIndex,
    scheduledDate,
    referenceDate = new Date(),
}: {
    accountId: string;
    gardenId: number;
    raisedBedId: number;
    positionIndex: number;
    scheduledDate: string;
    referenceDate?: Date;
}) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (
        !raisedBed ||
        raisedBed.accountId !== accountId ||
        raisedBed.gardenId !== gardenId
    ) {
        throw new GardenDiaryRescheduleError('Raised bed not found.', 404);
    }

    if (isRaisedBedAbandoned(raisedBed.status)) {
        throw new GardenDiaryRescheduleError('Raised bed is abandoned.', 409);
    }

    const field = raisedBed.fields.find(
        (candidate) =>
            candidate.positionIndex === positionIndex && candidate.active,
    );
    if (!field?.plantSortId) {
        throw new GardenDiaryRescheduleError('Plant field not found.', 404);
    }

    if (!isReschedulableFieldPlantStatus(field.plantStatus)) {
        throw new GardenDiaryRescheduleError(
            'Only planned plant fields can be rescheduled.',
            409,
        );
    }

    assertExistingScheduledDateCanMove(field.plantScheduledDate, referenceDate);

    const normalizedDate = normalizeDiaryRescheduleDate(
        scheduledDate,
        referenceDate,
    );

    await createEvent(
        knownEvents.raisedBedFields.plantScheduleV1(
            `${raisedBedId.toString()}|${positionIndex.toString()}`,
            {
                scheduledDate: normalizedDate.toISOString(),
            },
        ),
    );

    return {
        positionIndex,
        raisedBedId,
        scheduledDate: normalizedDate,
    };
}
