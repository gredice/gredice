import { Checkbox } from '@gredice/ui/Checkbox';
import type { ReactNode } from 'react';
import type { ScheduleTaskState } from './scheduleTaskState';

interface ScheduleTaskStateControlProps {
    action?: ReactNode;
    label: string;
    state: ScheduleTaskState;
    unavailableTitle: string;
}

export function ScheduleTaskStateControl({
    action,
    label,
    state,
    unavailableTitle,
}: ScheduleTaskStateControlProps) {
    if (state === 'completed') {
        return (
            <Checkbox
                aria-label={`Potvrđeno: ${label}`}
                className="size-5"
                checked
                disabled
            />
        );
    }

    if (state !== 'actionable') {
        return null;
    }

    if (action) {
        return action;
    }

    return (
        <div title={unavailableTitle}>
            <Checkbox
                aria-label={`Nije dostupno: ${label}. ${unavailableTitle}`}
                className="size-5"
                disabled
            />
        </div>
    );
}
