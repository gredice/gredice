import { Chip } from '@gredice/ui/Chip';
import { Timer } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { formatMinutes } from './scheduleShared';

interface ScheduleTaskDurationChipProps {
    compact?: boolean;
    minutes: number;
}

export function ScheduleTaskDurationChip({
    compact = false,
    minutes,
}: ScheduleTaskDurationChipProps) {
    if (minutes <= 0) {
        return null;
    }

    return (
        <Chip
            size="sm"
            color="neutral"
            variant="soft"
            title="Trajanje"
            className={cx(
                'bg-muted/60 text-muted-foreground',
                compact && 'px-1',
            )}
            startDecorator={compact ? undefined : <Timer aria-hidden="true" />}
        >
            {formatMinutes(minutes)}
        </Chip>
    );
}
