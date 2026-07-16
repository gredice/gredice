import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import {
    Disabled,
    Error as ErrorIcon,
    Hourglass,
    Verified,
    Warning,
} from '@gredice/ui/icons';
import type { ComponentType } from 'react';
import type { ScheduleTaskState } from './scheduleTaskState';

type VisibleScheduleTaskState = Exclude<ScheduleTaskState, 'actionable'>;

const statusConfig: Record<
    VisibleScheduleTaskState,
    {
        color: ColorPaletteProp;
        icon: ComponentType<{
            'aria-hidden'?: boolean;
            className?: string;
        }>;
        label: string;
    }
> = {
    pendingVerification: {
        color: 'warning',
        icon: Hourglass,
        label: 'Čeka potvrdu',
    },
    completed: {
        color: 'success',
        icon: Verified,
        label: 'Potvrđeno',
    },
    blocked: {
        color: 'warning',
        icon: Warning,
        label: 'Blokirano',
    },
    failed: {
        color: 'error',
        icon: ErrorIcon,
        label: 'Neuspjelo',
    },
    canceled: {
        color: 'neutral',
        icon: Disabled,
        label: 'Otkazano',
    },
};

interface ScheduleTaskStatusChipProps {
    state: ScheduleTaskState;
}

export function ScheduleTaskStatusChip({ state }: ScheduleTaskStatusChipProps) {
    if (state === 'actionable') {
        return null;
    }

    const config = statusConfig[state];
    const StatusIcon = config.icon;

    return (
        <Chip
            color={config.color}
            data-task-state={state}
            size="sm"
            startDecorator={<StatusIcon aria-hidden />}
            variant="soft"
        >
            {config.label}
        </Chip>
    );
}
