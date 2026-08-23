import { Chip } from '@gredice/ui/Chip';
import { Calendar } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { cx } from '@gredice/ui/utils';
import { getScheduleDateFormat, isScheduleDatePast } from './scheduleShared';

interface ScheduleTaskDateChipProps {
    compact?: boolean;
    scheduledDate: Date | string | null | undefined;
}

export function ScheduleTaskDateChip({
    compact = false,
    scheduledDate,
}: ScheduleTaskDateChipProps) {
    const isPast = isScheduleDatePast(scheduledDate);

    return (
        <Chip
            size="sm"
            color={isPast ? 'warning' : 'neutral'}
            variant="soft"
            title={isPast ? 'Planirani datum je u prošlosti' : 'Planirano'}
            className={cx(
                compact && 'px-1',
                !isPast && 'bg-muted/60 text-muted-foreground',
            )}
            startDecorator={
                compact ? undefined : <Calendar aria-hidden="true" />
            }
        >
            {scheduledDate ? (
                <LocalDateTime
                    time={false}
                    format={getScheduleDateFormat(scheduledDate)}
                >
                    {scheduledDate}
                </LocalDateTime>
            ) : (
                'Danas'
            )}
        </Chip>
    );
}
