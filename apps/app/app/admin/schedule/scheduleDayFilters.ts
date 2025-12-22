import {
    FIELD_STATUSES_TO_INCLUDE,
    isOperationCancelled,
    isOperationCompleted,
    OPERATION_STATUSES_TO_INCLUDE,
} from './scheduleShared';
import type { DeliveryRequest, Operation, RaisedBed } from './types';

export function getScheduledFieldsForDay(
    isToday: boolean,
    date: Date,
    raisedBeds: RaisedBed[],
) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return raisedBeds
        .filter((raisedBed) => Boolean(raisedBed.physicalId))
        .flatMap((raisedBed) => raisedBed.fields)
        .filter((field) => {
            if (!FIELD_STATUSES_TO_INCLUDE.has(field.plantStatus ?? 'new')) {
                return false;
            }

            if (field.plantStatus === 'sowed' && field.plantSowDate) {
                const sowDate = new Date(field.plantSowDate);
                return sowDate.toDateString() === normalizedDate.toDateString();
            }

            if (!field.plantScheduledDate) {
                return isToday;
            }

            const scheduledDate = new Date(field.plantScheduledDate);

            return (
                normalizedDate.toDateString() ===
                    scheduledDate.toDateString() ||
                (isToday && normalizedDate > scheduledDate)
            );
        });
}

export function getScheduledOperationsForDay(
    isToday: boolean,
    date: Date,
    operations: Operation[],
) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return operations.filter((operation) => {
        if (!OPERATION_STATUSES_TO_INCLUDE.has(operation.status)) {
            return false;
        }

        if (operation.raisedBedId === null) {
            return false;
        }

        if (isOperationCompleted(operation.status) && operation.completedAt) {
            const completedDate = new Date(operation.completedAt);
            return (
                completedDate.toDateString() === normalizedDate.toDateString()
            );
        }

        const scheduledDate = operation.scheduledDate
            ? new Date(operation.scheduledDate)
            : undefined;
        const sameDay =
            scheduledDate !== undefined &&
            normalizedDate.toDateString() === scheduledDate.toDateString();
        const isUnscheduledToday = scheduledDate === undefined && isToday;
        const isOverdueToday =
            scheduledDate !== undefined &&
            isToday &&
            normalizedDate > scheduledDate &&
            !isOperationCompleted(operation.status) &&
            !isOperationCancelled(operation.status);

        return sameDay || isUnscheduledToday || isOverdueToday;
    });
}

export function getDayDeliveryRequests(
    isToday: boolean,
    date: Date,
    deliveryRequests: DeliveryRequest[],
) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    const dateString = normalizedDate.toDateString();

    return deliveryRequests
        .filter((request) => {
            const slotStart = request.slot?.startAt
                ? new Date(request.slot.startAt)
                : undefined;

            if (slotStart) {
                const sameDay = slotStart.toDateString() === dateString;
                const overdueToday =
                    isToday &&
                    slotStart < normalizedDate &&
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
