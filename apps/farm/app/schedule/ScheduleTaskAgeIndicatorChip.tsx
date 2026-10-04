import { Chip } from '@gredice/ui/Chip';
import { Warning } from '@gredice/ui/icons';
import { getScheduleTaskAgeIndicator } from './scheduleShared';

interface ScheduleTaskAgeIndicatorChipProps {
    scheduledDate: Date | string | null | undefined;
}

export function ScheduleTaskAgeIndicatorChip({
    scheduledDate,
}: ScheduleTaskAgeIndicatorChipProps) {
    const indicator = getScheduleTaskAgeIndicator(scheduledDate);

    if (!indicator) {
        return null;
    }

    return (
        <Chip
            size="sm"
            color={indicator.level === 'critical' ? 'error' : 'warning'}
            variant="soft"
            startDecorator={<Warning aria-hidden="true" />}
            title={indicator.title}
            aria-label={indicator.title}
        >
            {indicator.label}
        </Chip>
    );
}
