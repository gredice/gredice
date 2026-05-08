import type { EntityStandardized } from '@gredice/storage';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
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
    const raisedBedIds = new Set(
        [
            ...scheduledOperations.map((op) => op.raisedBedId),
            ...scheduledFields.map((field) => field.raisedBedId),
        ].filter(Boolean),
    );
    const raisedBedCount = raisedBedIds.size;

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
        <Row spacing={4}>
            <SummaryItem label="Zadataka" value={taskCount} />
            <SummaryItem label="Gredica" value={raisedBedCount} />
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
        <div className="text-center">
            <Typography level="body2" semiBold>
                {value}
            </Typography>
            <Typography level="body2" className="text-muted-foreground">
                {label}
            </Typography>
        </div>
    );
}
