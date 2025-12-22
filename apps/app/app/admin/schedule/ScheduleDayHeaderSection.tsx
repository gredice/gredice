import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { ScheduleDayHeader } from './ScheduleDayHeader';
import {
    getScheduleOperations,
    getScheduleOperationsData,
    getScheduleRaisedBeds,
} from './scheduleData';
import {
    getScheduledFieldsForDay,
    getScheduledOperationsForDay,
} from './scheduleDayFilters';
import {
    formatMinutes,
    getOperationDurationMinutes,
    isFieldApproved,
    isFieldCompleted,
    isOperationCancelled,
    isOperationCompleted,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';

interface ScheduleDayHeaderSectionProps {
    isToday: boolean;
    date: Date;
}

export async function ScheduleDayHeaderSection({
    isToday,
    date,
}: ScheduleDayHeaderSectionProps) {
    const [raisedBeds, operations, operationsData] = await Promise.all([
        getScheduleRaisedBeds(),
        getScheduleOperations(),
        getScheduleOperationsData(),
    ]);

    const scheduledFields = getScheduledFieldsForDay(isToday, date, raisedBeds);
    const scheduledOperations = getScheduledOperationsForDay(
        isToday,
        date,
        operations,
    );

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const operationData of operationsData) {
            operationDataById.set(operationData.id, operationData);
        }
    }

    const totalTasksCount = scheduledFields.length + scheduledOperations.length;
    let approvedTasksCount = 0;
    let completedTasksCount = 0;
    let totalDuration = 0;
    let approvedDuration = 0;
    let completedDuration = 0;

    for (const field of scheduledFields) {
        const completed = isFieldCompleted(field.plantStatus);
        const approved = isFieldApproved(field.plantStatus);
        totalDuration += PLANTING_TASK_DURATION_MINUTES;
        if (approved) {
            approvedDuration += PLANTING_TASK_DURATION_MINUTES;
            approvedTasksCount += 1;
        }
        if (completed) {
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

    const summaryCopyText = [
        `Sažetak za ${new Intl.DateTimeFormat('hr-HR', {
            dateStyle: 'full',
        }).format(date)}`,
        `Odobreni zadaci: ${approvedTasksCount}`,
        `Odobreno vrijeme: ${formatMinutes(approvedDuration)}`,
    ].join('\n');

    return (
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
    );
}
