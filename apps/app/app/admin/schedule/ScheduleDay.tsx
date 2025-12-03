'use client';

import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { DeliveryRequestsSection } from './DeliveryRequestsSection';
import { RaisedBedScheduleSection } from './RaisedBedScheduleSection';
import { ScheduleDayHeader } from './ScheduleDayHeader';
import {
    FIELD_STATUSES_TO_INCLUDE,
    formatMinutes,
    getOperationDurationMinutes,
    isFieldApproved,
    isFieldCompleted,
    isOperationCancelled,
    isOperationCompleted,
    OPERATION_STATUSES_TO_INCLUDE,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';
import type { DeliveryRequest, Operation, RaisedBed } from './types';

interface ScheduleDayProps {
    isToday: boolean;
    date: Date;
    allRaisedBeds: RaisedBed[];
    operations: Operation[];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
    userId: string;
    deliveryRequests: DeliveryRequest[];
}

function getDaySchedule(
    isToday: boolean,
    date: Date,
    raisedBeds: RaisedBed[],
    operations: Operation[],
) {
    const todaysFields = raisedBeds
        .filter((raisedBed) => Boolean(raisedBed.physicalId))
        .flatMap((rb) => rb.fields)
        .filter((field) => {
            if (!FIELD_STATUSES_TO_INCLUDE.has(field.plantStatus ?? 'new')) {
                return false;
            }

            if (field.plantStatus === 'sowed' && field.plantSowDate) {
                const sowDate = new Date(field.plantSowDate);
                return sowDate.toDateString() === date.toDateString();
            }

            if (!field.plantScheduledDate) {
                return isToday;
            }

            const scheduledDate = new Date(field.plantScheduledDate);

            return (
                date.toDateString() === scheduledDate.toDateString() ||
                (isToday && date > scheduledDate)
            );
        });

    const todaysOperations = operations.filter((op) => {
        if (!OPERATION_STATUSES_TO_INCLUDE.has(op.status)) {
            return false;
        }

        if (op.raisedBedId === null) {
            return false;
        }

        if (isOperationCompleted(op.status) && op.completedAt) {
            const completedDate = new Date(op.completedAt);
            return completedDate.toDateString() === date.toDateString();
        }

        const scheduledDate = op.scheduledDate
            ? new Date(op.scheduledDate)
            : undefined;
        const sameDay =
            scheduledDate !== undefined &&
            date.toDateString() === scheduledDate.toDateString();
        const isUnscheduledToday = scheduledDate === undefined && isToday;
        const isOverdueToday =
            scheduledDate !== undefined &&
            isToday &&
            date > scheduledDate &&
            !isOperationCompleted(op.status) &&
            !isOperationCancelled(op.status);

        return sameDay || isUnscheduledToday || isOverdueToday;
    });

    const todayAffectedRaisedBedIds = [
        ...new Set([
            ...todaysOperations
                .map((op) => op.raisedBedId)
                .filter((id): id is number => id !== null),
            ...todaysFields.map((field) => field.raisedBedId),
        ]),
    ];

    const physicalIds = [
        ...new Set(
            raisedBeds
                .filter((rb) => todayAffectedRaisedBedIds.includes(rb.id))
                .map((rb) => rb.physicalId)
                .filter((id): id is string => id !== null),
        ),
    ].sort((a, b) => Number(a) - Number(b));

    return {
        fields: todaysFields,
        operations: todaysOperations,
        affectedRaisedBedPhysicalIds: physicalIds,
    };
}

function getDayDeliveryRequests(
    isToday: boolean,
    date: Date,
    deliveryRequests: DeliveryRequest[],
) {
    const dateString = date.toDateString();

    return deliveryRequests
        .filter((request) => {
            const slotStart = request.slot?.startAt
                ? new Date(request.slot.startAt)
                : undefined;

            if (slotStart) {
                const sameDay = slotStart.toDateString() === dateString;
                const overdueToday =
                    isToday &&
                    slotStart < date &&
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

export function ScheduleDay({
    isToday,
    date,
    allRaisedBeds,
    operations,
    plantSorts,
    operationsData,
    userId,
    deliveryRequests,
}: ScheduleDayProps) {
    const {
        fields: scheduledFields,
        operations: scheduledOperations,
        affectedRaisedBedPhysicalIds,
    } = getDaySchedule(isToday, date, allRaisedBeds, operations);

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const operationData of operationsData) {
            operationDataById.set(operationData.id, operationData);
        }
    }

    const todaysDeliveryRequests = getDayDeliveryRequests(
        isToday,
        date,
        deliveryRequests,
    );

    const totalTasksCount = scheduledFields.length + scheduledOperations.length;
    let approvedTasksCount = 0;
    let completedTasksCount = 0;
    let totalDuration = 0;
    let approvedDuration = 0;
    let completedDuration = 0;

    for (const field of scheduledFields) {
        const isCompleted = isFieldCompleted(field.plantStatus);
        const isApproved = isFieldApproved(field.plantStatus);
        totalDuration += PLANTING_TASK_DURATION_MINUTES;
        if (isApproved) {
            approvedDuration += PLANTING_TASK_DURATION_MINUTES;
            approvedTasksCount += 1;
        }
        if (isCompleted) {
            completedDuration += PLANTING_TASK_DURATION_MINUTES;
            completedTasksCount += 1;
        }
    }

    for (const operation of scheduledOperations) {
        const operationDuration = getOperationDurationMinutes(
            operationDataById.get(operation.entityId),
        );
        totalDuration += operationDuration;
        const completed = isOperationCompleted(operation.status);
        if (completed) {
            completedDuration += operationDuration;
            completedTasksCount += 1;
        }
        if (
            operation.isAccepted &&
            !completed &&
            !isOperationCancelled(operation.status)
        ) {
            approvedDuration += operationDuration;
            approvedTasksCount += 1;
        }
    }

    const hasTasks = totalTasksCount > 0;
    const summaryCopyText = [
        `Sažetak za ${new Intl.DateTimeFormat('hr-HR', {
            dateStyle: 'full',
        }).format(date)}`,
        `Odobreni zadaci: ${approvedTasksCount}`,
        `Odobreno vrijeme: ${formatMinutes(approvedDuration)}`,
    ].join('\n');

    return (
        <Stack className="grow" spacing={2}>
            <ScheduleDayHeader
                date={date}
                isToday={isToday}
                approvedTasksCount={approvedTasksCount}
                completedTasksCount={completedTasksCount}
                totalTasksCount={totalTasksCount}
                approvedDuration={approvedDuration}
                completedDuration={completedDuration}
                totalDuration={totalDuration}
                summaryCopyText={summaryCopyText}
            />
            {!hasTasks && (
                <Typography level="body2" className="leading-[56px]">
                    Trenutno nema zadataka za ovaj dan.
                </Typography>
            )}
            {affectedRaisedBedPhysicalIds.map((physicalId) => {
                const raisedBeds = allRaisedBeds
                    .filter((rb) => rb.physicalId === physicalId)
                    .sort((a, b) => a.id - b.id);

                return (
                    <RaisedBedScheduleSection
                        key={physicalId}
                        physicalId={physicalId}
                        raisedBeds={raisedBeds}
                        scheduledFields={scheduledFields}
                        scheduledOperations={scheduledOperations}
                        plantSorts={plantSorts}
                        operationDataById={operationDataById}
                        userId={userId}
                    />
                );
            })}
            <DeliveryRequestsSection requests={todaysDeliveryRequests} />
        </Stack>
    );
}
