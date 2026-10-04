import { MapPin } from '@gredice/ui/icons';

type ScheduleTaskLocationProps = {
    inline?: boolean;
    positionNumber?: number | null;
    raisedBedLabel?: string | null;
};

export function ScheduleTaskLocation({
    inline = false,
    positionNumber,
    raisedBedLabel,
}: ScheduleTaskLocationProps) {
    if (
        !raisedBedLabel &&
        (positionNumber === null || positionNumber === undefined)
    ) {
        return null;
    }

    return (
        <div
            className={
                inline
                    ? 'contents text-sm font-semibold text-foreground'
                    : 'flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground'
            }
            data-schedule-task-location
        >
            {raisedBedLabel ? (
                <span className="inline-flex min-h-7 min-w-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 text-primary [overflow-wrap:anywhere]">
                    <MapPin aria-hidden className="size-4 shrink-0" />
                    {raisedBedLabel}
                </span>
            ) : null}
            {positionNumber === null || positionNumber === undefined ? null : (
                <span className="inline-flex min-h-7 items-center rounded-md bg-amber-100 px-1.5 font-bold text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
                    Pozicija {positionNumber}
                </span>
            )}
        </div>
    );
}
