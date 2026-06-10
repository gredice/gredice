import { plantFieldStatusEmoji } from '@gredice/js/plants';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';

export type HarvestTraceStatusEventItem = {
    description?: string;
    location?: {
        fieldLabel?: string;
        raisedBedName: string;
        raisedBedPhysicalId: string | null;
    };
    plantStatus: string;
    title: string;
};

function statusTimelineIconClassName(status: string) {
    if (status === 'sowed' || status === 'pendingVerification') {
        return 'bg-amber-100 text-amber-950 dark:bg-amber-900/70 dark:text-amber-100 dark:ring-1 dark:ring-amber-400/30';
    }

    if (status === 'sprouted') {
        return 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900/70 dark:text-emerald-100 dark:ring-1 dark:ring-emerald-400/30';
    }

    if (status === 'firstFlowers') {
        return 'bg-pink-100 text-pink-950 dark:bg-pink-900/70 dark:text-pink-100 dark:ring-1 dark:ring-pink-400/30';
    }

    if (status === 'firstFruitSet') {
        return 'bg-red-100 text-red-950 dark:bg-red-900/70 dark:text-red-100 dark:ring-1 dark:ring-red-400/30';
    }

    if (status === 'ready') {
        return 'bg-orange-100 text-orange-950 dark:bg-orange-900/70 dark:text-orange-100 dark:ring-1 dark:ring-orange-400/30';
    }

    if (status === 'harvested') {
        return 'bg-lime-100 text-lime-950 dark:bg-lime-900/70 dark:text-lime-100 dark:ring-1 dark:ring-lime-400/30';
    }

    if (status === 'removed') {
        return 'bg-stone-100 text-stone-950 dark:bg-stone-800 dark:text-stone-100 dark:ring-1 dark:ring-stone-400/30';
    }

    if (status === 'notSprouted' || status === 'died') {
        return 'bg-red-100 text-red-950 dark:bg-red-900/70 dark:text-red-100 dark:ring-1 dark:ring-red-400/30';
    }

    return 'bg-muted text-foreground';
}

function statusTimelineItemClassName(status: string) {
    if (status === 'sowed' || status === 'pendingVerification') {
        return 'border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-400/45 dark:bg-amber-950/45 dark:text-amber-50';
    }

    if (status === 'sprouted') {
        return 'border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-400/45 dark:bg-emerald-950/45 dark:text-emerald-50';
    }

    if (status === 'firstFlowers') {
        return 'border-pink-200 bg-pink-50/80 text-pink-950 dark:border-pink-400/45 dark:bg-pink-950/45 dark:text-pink-50';
    }

    if (status === 'firstFruitSet') {
        return 'border-red-200 bg-red-50/80 text-red-950 dark:border-red-400/45 dark:bg-red-950/50 dark:text-red-50';
    }

    if (status === 'ready') {
        return 'border-orange-200 bg-orange-50/80 text-orange-950 dark:border-orange-400/45 dark:bg-orange-950/45 dark:text-orange-50';
    }

    if (status === 'harvested') {
        return 'border-lime-200 bg-lime-50/80 text-lime-950 dark:border-lime-400/45 dark:bg-lime-950/45 dark:text-lime-50';
    }

    if (status === 'removed') {
        return 'border-stone-200 bg-stone-50/80 text-stone-950 dark:border-stone-500/60 dark:bg-stone-900/60 dark:text-stone-100';
    }

    if (status === 'notSprouted' || status === 'died') {
        return 'border-red-200 bg-red-50/80 text-red-950 dark:border-red-400/45 dark:bg-red-950/50 dark:text-red-50';
    }

    return 'border-border bg-muted/40 text-foreground dark:bg-muted/60';
}

export function HarvestTraceStatusEvent({
    item,
}: {
    item: HarvestTraceStatusEventItem;
}) {
    return (
        <article
            className={cx(
                '-mx-2 flex min-w-0 gap-3 rounded-lg border px-2 py-2 shadow-xs',
                statusTimelineItemClassName(item.plantStatus),
            )}
        >
            <span
                className={cx(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg text-xl leading-none',
                    statusTimelineIconClassName(item.plantStatus),
                )}
                aria-hidden="true"
            >
                {plantFieldStatusEmoji(item.plantStatus)}
            </span>
            <Stack spacing={1} className="min-w-0">
                <Typography semiBold className="break-words leading-snug">
                    {item.title}
                </Typography>
                {item.description ? (
                    <Typography level="body2" className="text-current/75">
                        {item.description}
                    </Typography>
                ) : null}
                {item.location ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                        <RaisedBedLabel
                            physicalId={item.location.raisedBedPhysicalId}
                            name={item.location.raisedBedName}
                            size="compact"
                        />
                        {item.location.fieldLabel ? (
                            <Typography
                                level="body2"
                                className="text-current/70"
                            >
                                Polje {item.location.fieldLabel}
                            </Typography>
                        ) : null}
                    </div>
                ) : null}
            </Stack>
        </article>
    );
}
