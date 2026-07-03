import { Chip } from '@gredice/ui/Chip';
import { Calendar } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { getScheduleDateFormat, isScheduleDatePast } from './scheduleShared';

interface ScheduleTaskDateChipProps {
    scheduledDate: Date | string | null | undefined;
}

export function ScheduleTaskDateChip({
    scheduledDate,
}: ScheduleTaskDateChipProps) {
    const isPast = isScheduleDatePast(scheduledDate);

    return (
        <Chip
            size="sm"
            color={isPast ? 'warning' : 'neutral'}
            variant="soft"
            title={isPast ? 'Planirani datum je u prošlosti' : 'Planirano'}
            className={isPast ? undefined : 'bg-muted/60 text-muted-foreground'}
            startDecorator={<Calendar aria-hidden="true" />}
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
