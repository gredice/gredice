import { knownEvents } from './events/knownEvents';
import { createEvent } from './eventsRepo';
import { createOperation, getOperations } from './operationsRepo';

export const FREE_WATERING_OPERATION_ID = 274;

type SeasonalSowingOffer = {
    freeWaterings: number;
    dayInterval: number;
};

function getSeasonalSowingOffer(date: Date): SeasonalSowingOffer | null {
    const month = date.getUTCMonth() + 1;

    if (month >= 3 && month <= 5) {
        return {
            freeWaterings: 3,
            dayInterval: 2,
        };
    }

    if (month >= 6 && month <= 8) {
        return {
            freeWaterings: 5,
            dayInterval: 1,
        };
    }

    if (month >= 9 && month <= 11) {
        return {
            freeWaterings: 3,
            dayInterval: 2,
        };
    }

    return null;
}

function toUtcDayKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

function getScheduledWateringDayKeys(
    operations: Awaited<ReturnType<typeof getOperations>>,
) {
    return new Set(
        operations.flatMap((operation) => {
            if (
                operation.entityId !== FREE_WATERING_OPERATION_ID ||
                operation.status === 'canceled' ||
                operation.status === 'failed' ||
                !operation.scheduledDate
            ) {
                return [];
            }

            return [toUtcDayKey(operation.scheduledDate)];
        }),
    );
}

function addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
}


export async function queueSeasonalSowingOfferOperations({
    accountId,
    gardenId,
    raisedBedId,
    referenceDate = new Date(),
}: {
    accountId: string;
    gardenId?: number;
    raisedBedId: number;
    referenceDate?: Date;
}) {
    const offer = getSeasonalSowingOffer(referenceDate);
    if (!offer) {
        return [];
    }

    const existingOperations = await getOperations(
        accountId,
        gardenId,
        raisedBedId,
    );

    const scheduledWateringDayKeys = getScheduledWateringDayKeys(existingOperations);

    const createdOperationIds: number[] = [];
    for (let index = 0; index < offer.freeWaterings; index += 1) {
        const scheduledDate = addDays(referenceDate, index * offer.dayInterval);
        const scheduledDayKey = toUtcDayKey(scheduledDate);
        if (scheduledWateringDayKeys.has(scheduledDayKey)) {
            continue;
        }

        const operationId = await createOperation({
            accountId,
            entityId: FREE_WATERING_OPERATION_ID,
            entityTypeName: 'operation',
            gardenId,
            raisedBedId,
        });

        await createEvent(
            knownEvents.operations.scheduledV1(operationId.toString(), {
                scheduledDate: scheduledDate.toISOString(),
            }),
        );

        scheduledWateringDayKeys.add(scheduledDayKey);
        createdOperationIds.push(operationId);
    }

    return createdOperationIds;
}
