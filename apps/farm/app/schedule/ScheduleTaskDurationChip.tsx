import { Chip } from '@gredice/ui/Chip';
import { Timer } from '@gredice/ui/icons';
import { formatMinutes } from './scheduleShared';

interface ScheduleTaskDurationChipProps {
    minutes: number;
}

export function ScheduleTaskDurationChip({
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
            className="bg-muted/60 text-muted-foreground"
            startDecorator={<Timer aria-hidden="true" />}
        >
            {formatMinutes(minutes)}
        </Chip>
    );
}
