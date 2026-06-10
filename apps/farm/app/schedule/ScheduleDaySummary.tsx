import type { EntityStandardized } from '@gredice/storage';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import type { FarmScheduleDayData } from './scheduleData';
import {
    getOperationDurationMinutes,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';

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

    const taskCount = scheduledOperations.length + scheduledFields.length;

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const op of operationsData) {
            operationDataById.set(op.id, op);
        }
    }

    const totalMinutes =
        scheduledOperations.reduce(
            (sum, op) =>
                sum +
                getOperationDurationMinutes(operationDataById.get(op.entityId)),
            0,
        ) +
        scheduledFields.length * PLANTING_TASK_DURATION_MINUTES;

    return (
        <Row className="gap-1 sm:gap-2">
            <SummaryItem label="Zadataka" value={taskCount} />
            {totalMinutes > 0 && (
                <SummaryItem
                    label="Vrijeme"
                    value={formatMinutes(totalMinutes)}
                />
            )}
        </Row>
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
        <div className="text-center leading-tight">
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
