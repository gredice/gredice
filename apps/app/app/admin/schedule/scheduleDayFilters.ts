import {
    FIELD_STATUSES_TO_INCLUDE,
    isFieldBlocked,
    isFieldPendingVerification,
    isOperationBlocked,
    isOperationCancelled,
    isOperationCompleted,
    isOperationPendingVerification,
    OPERATION_STATUSES_TO_INCLUDE,
} from './scheduleShared';
import { getScheduleDateKey } from './scheduleTimeZone';
import type { DeliveryRequest, Operation, RaisedBed } from './types';

export function getScheduledFieldsForDay(
    isToday: boolean,
    dateKey: string,
    raisedBeds: RaisedBed[],
    timeZone: string,
) {
    return raisedBeds
        .filter((raisedBed) => Boolean(raisedBed.physicalId))
        .flatMap((raisedBed) => raisedBed.fields)
        .filter((field) => {
            // Placeholder field rows represent empty slots in a merged bed and
            // should not surface as unknown sowing tasks.
            if (!field.plantSortId) {
                return false;
            }

            if (!FIELD_STATUSES_TO_INCLUDE.has(field.plantStatus ?? 'new')) {
                return false;
            }

            if (isFieldBlocked(field.plantStatus)) {
                if (!field.blockedAt) {
                    return isToday;
                }

                const blockedDateKey = getScheduleDateKey(
                    new Date(field.blockedAt),
                    timeZone,
                );
                return (
                    blockedDateKey === dateKey ||
                    (isToday && blockedDateKey < dateKey)
                );
            }

            if (isFieldPendingVerification(field.plantStatus)) {
                if (!field.plantSowDate) {
                    return isToday;
                }

                const sowDateKey = getScheduleDateKey(
                    new Date(field.plantSowDate),
                    timeZone,
                );
                return (
                    sowDateKey === dateKey || (isToday && sowDateKey < dateKey)
                );
            }

            if (field.plantStatus === 'sowed' && field.plantSowDate) {
                return (
                    getScheduleDateKey(
                        new Date(field.plantSowDate),
                        timeZone,
                    ) === dateKey
                );
            }

            if (!field.plantScheduledDate) {
                return isToday;
            }

            const scheduledDateKey = getScheduleDateKey(
                new Date(field.plantScheduledDate),
                timeZone,
            );

            return (
                scheduledDateKey === dateKey ||
                (isToday && scheduledDateKey < dateKey)
            );
        });
}

export function getScheduledOperationsForDay(
    isToday: boolean,
    dateKey: string,
    operations: Operation[],
    timeZone: string,
) {
    return operations.filter((operation) => {
        if (!OPERATION_STATUSES_TO_INCLUDE.has(operation.status)) {
            return false;
        }

        if (
            operation.raisedBedId === null &&
            typeof operation.farmId !== 'number'
        ) {
            return false;
        }

        if (isOperationBlocked(operation.status)) {
            if (!operation.blockedAt) {
                return isToday;
            }

            const blockedDateKey = getScheduleDateKey(
                new Date(operation.blockedAt),
                timeZone,
            );
            return (
                blockedDateKey === dateKey ||
                (isToday && blockedDateKey < dateKey)
            );
        }

        if (isOperationPendingVerification(operation.status)) {
            if (!operation.completedAt) {
                return isToday;
            }

            const completedDateKey = getScheduleDateKey(
                new Date(operation.completedAt),
                timeZone,
            );
            return (
                completedDateKey === dateKey ||
                (isToday && completedDateKey < dateKey)
            );
        }

        if (isOperationCompleted(operation.status) && operation.completedAt) {
            return (
                getScheduleDateKey(
                    new Date(operation.completedAt),
                    timeZone,
                ) === dateKey
            );
        }

        const scheduledDateKey = operation.scheduledDate
            ? getScheduleDateKey(new Date(operation.scheduledDate), timeZone)
            : undefined;
        const sameDay =
            scheduledDateKey !== undefined && scheduledDateKey === dateKey;
        const isUnscheduledToday = scheduledDateKey === undefined && isToday;
        const isOverdueToday =
            scheduledDateKey !== undefined &&
            isToday &&
            scheduledDateKey < dateKey &&
            !isOperationCompleted(operation.status) &&
            !isOperationPendingVerification(operation.status) &&
            !isOperationCancelled(operation.status);

        return sameDay || isUnscheduledToday || isOverdueToday;
    });
}

export function getDayDeliveryRequests(
    isToday: boolean,
    dateKey: string,
    deliveryRequests: DeliveryRequest[],
    timeZone: string,
) {
    return deliveryRequests
        .filter((request) => {
            const slotStart = request.slot?.startAt
                ? new Date(request.slot.startAt)
                : undefined;

            if (slotStart) {
                const slotDateKey = getScheduleDateKey(slotStart, timeZone);
                const sameDay = slotDateKey === dateKey;
                const overdueToday =
                    isToday &&
                    slotDateKey < dateKey &&
                    request.state !== 'fulfilled' &&
                    request.state !== 'cancelled';
                return sameDay || overdueToday;
            }

            return (
                isToday &&
                request.state !== 'fulfilled' &&
                request.state !== 'cancelled'
            );
        })
        .sort((a, b) => {
            const aTime = a.slot?.startAt
                ? new Date(a.slot.startAt).getTime()
                : Number.POSITIVE_INFINITY;
            const bTime = b.slot?.startAt
                ? new Date(b.slot.startAt).getTime()
                : Number.POSITIVE_INFINITY;
            return aTime - bTime;
        });
}
