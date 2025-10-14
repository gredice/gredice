import { TimeRange } from '@gredice/ui/LocalDateTime';
import { Typography } from '@signalco/ui-primitives/Typography';

export interface TimeSlotData {
    startAt: Date;
    endAt: Date;
}

export function TimeSlotDisplay({
    slot,
    fallback = 'Bez termina',
    isOverdue = false,
    className,
}: {
    slot: TimeSlotData | null | undefined;
    fallback?: string;
    isOverdue?: boolean;
    className?: string;
}) {
    if (!slot) {
        return (
            <Typography
                level="body2"
                className={className || 'text-muted-foreground'}
            >
                {fallback}
            </Typography>
        );
    }

    return (
        <Typography
            level="body2"
            className={isOverdue ? 'text-red-600' : className}
        >
            <TimeRange startAt={slot.startAt} endAt={slot.endAt} />
        </Typography>
    );
}
