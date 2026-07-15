import type { EntityStandardized } from '@gredice/storage';
import { Typography } from '@gredice/ui/Typography';
import type { FarmScheduleDayData } from './scheduleData';
import {
    getOperationDurationMinutes,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';
import {
    getOperationTaskState,
    getPlantingTaskState,
    getScheduleTaskSummary,
    type ScheduleTaskSummary,
    type ScheduleTaskSummaryItem,
} from './scheduleTaskState';

function formatMinutes(minutes: number) {
    const rounded = Math.ceil(Math.max(0, minutes));
    if (rounded >= 60) {
        const hours = Math.floor(rounded / 60);
        const remaining = rounded % 60;
        return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`;
    }
    return `${rounded} min`;
}

interface ScheduleDaySummaryProps {
    dayData: FarmScheduleDayData;
    operationsData: EntityStandardized[] | null | undefined;
}

export function ScheduleDaySummary({
    dayData,
    operationsData,
}: ScheduleDaySummaryProps) {
    const { scheduledFields, scheduledOperations } = dayData;

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const op of operationsData) {
            operationDataById.set(op.id, op);
        }
    }

    const plantingItems = scheduledFields.flatMap((field) => {
        const state = getPlantingTaskState(field.plantStatus);

        return state
            ? [
                  {
                      state,
                      durationMinutes: PLANTING_TASK_DURATION_MINUTES,
                  },
              ]
            : [];
    });
    const operationItems = scheduledOperations.map((operation) => ({
        state: getOperationTaskState(operation.status),
        durationMinutes: getOperationDurationMinutes(
            operationDataById.get(operation.entityId),
        ),
    }));
    const summaryItems: ScheduleTaskSummaryItem[] = [
        ...plantingItems,
        ...operationItems,
    ];
    const summary = getScheduleTaskSummary(summaryItems);

    return <ScheduleDaySummaryView summary={summary} />;
}

export function ScheduleDaySummaryView({
    summary,
}: {
    summary: ScheduleTaskSummary;
}) {
    return (
        <section
            aria-label="Sažetak dnevnih zadataka"
            className="grid w-full grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] items-start gap-2 sm:flex sm:w-auto sm:justify-end"
        >
            <SummaryItem label="Preostalo" value={summary.actionable.count} />
            <SummaryItem
                label="Čeka potvrdu"
                value={summary.pendingVerification.count}
            />
            <SummaryItem label="Potvrđeno" value={summary.completed.count} />
            {summary.actionable.durationMinutes > 0 && (
                <SummaryItem
                    label="Preostalo vrijeme"
                    value={formatMinutes(summary.actionable.durationMinutes)}
                />
            )}
            {summary.failed.count > 0 && (
                <SummaryItem label="Neuspjelo" value={summary.failed.count} />
            )}
            {summary.canceled.count > 0 && (
                <SummaryItem label="Otkazano" value={summary.canceled.count} />
            )}
        </section>
    );
}

function SummaryItem({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div className="min-w-0 text-center leading-tight">
            <Typography level="body2" semiBold className="text-xs sm:text-sm">
                {value}
            </Typography>
            <Typography
                level="body2"
                className="text-xs text-muted-foreground sm:text-sm"
            >
                {label}
            </Typography>
        </div>
    );
}
