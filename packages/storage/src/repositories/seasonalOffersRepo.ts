import { knownEvents } from './events/knownEvents';
import { createEvent } from './eventsRepo';
import { createOperation, getOperations } from './operationsRepo';

const FREE_WATERING_OPERATION_ID = 274;

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

function addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
}

function getLatestScheduledFreeWateringDate(
    operations: Awaited<ReturnType<typeof getOperations>>,
    now: Date,
) {
    const scheduledDates = operations.flatMap((operation) => {
        if (
            operation.entityId !== FREE_WATERING_OPERATION_ID ||
            operation.status === 'canceled' ||
            operation.status === 'failed' ||
            !operation.scheduledDate ||
            operation.scheduledDate < now
        ) {
            return [];
        }

        return [operation.scheduledDate];
    });

    return scheduledDates.sort(
        (left, right) => right.getTime() - left.getTime(),
    )[0];
}

export async function queueSeasonalSowingOfferOperations({
    accountId,
    gardenId,
    raisedBedId,
    referenceDate = new Date(),
}: {
    accountId: string;
    gardenId?: number | null;
    raisedBedId: number;
    referenceDate?: Date;
}) {
    const offer = getSeasonalSowingOffer(referenceDate);
    if (!offer) {
        return [];
    }

    const existingOperations = await getOperations(
        accountId,
        gardenId ?? undefined,
        raisedBedId,
    );

    const latestScheduledDate = getLatestScheduledFreeWateringDate(
        existingOperations,
        referenceDate,
    );

    const firstScheduleDate = latestScheduledDate
        ? addDays(latestScheduledDate, offer.dayInterval)
        : new Date(referenceDate);

    const createdOperationIds: number[] = [];
    for (let index = 0; index < offer.freeWaterings; index += 1) {
        const scheduledDate = addDays(
            firstScheduleDate,
            index * offer.dayInterval,
        );

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

        createdOperationIds.push(operationId);
    }

    return createdOperationIds;
}
