import { Button } from '@gredice/ui/Button';
import { Lock } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import type { ScheduleTaskState } from './scheduleTaskState';

interface ScheduleTaskStateControlProps {
    action?: ReactNode;
    actionLabel: string;
    label: string;
    state: ScheduleTaskState;
    unavailableTitle: string;
}

export function ScheduleTaskStateControl({
    action,
    actionLabel,
    label,
    state,
    unavailableTitle,
}: ScheduleTaskStateControlProps) {
    if (state !== 'actionable') {
        return null;
    }

    if (action) {
        return (
            <div
                className="mt-2 border-t pt-2 [&>*]:w-full"
                data-schedule-task-completion="available"
            >
                {action}
            </div>
        );
    }

    return (
        <div
            className="mt-2 space-y-1 border-t pt-2"
            data-schedule-task-completion="locked"
        >
            <Button
                aria-label={`Nije dostupno: ${actionLabel} za ${label}. ${unavailableTitle}`}
                className="h-auto min-h-11 whitespace-normal py-2 [overflow-wrap:anywhere]"
                disabled
                fullWidth
                size="lg"
                startDecorator={<Lock aria-hidden className="size-4" />}
                type="button"
                variant="outlined"
            >
                {actionLabel}
            </Button>
            <Typography
                className="text-muted-foreground [overflow-wrap:anywhere]"
                level="body2"
            >
                {unavailableTitle}
            </Typography>
        </div>
    );
}
