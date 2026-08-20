import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    buildHarvestTraceWateringGrid,
    type HarvestTraceWateringGridItem,
} from './wateringGridModel';

const monthFormatter = new Intl.DateTimeFormat('hr-HR', { month: 'short' });
const accessibleDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

const intensityClassNames = [
    'bg-muted/50 ring-1 ring-inset ring-border/60',
    'bg-sky-200 dark:bg-sky-950',
    'bg-sky-400 dark:bg-sky-700',
    'bg-sky-600 dark:bg-sky-500',
    'bg-sky-800 dark:bg-sky-300',
] as const;

function wateringCountLabel(count: number) {
    if (count === 1) {
        return '1 zalijevanje';
    }

    return `${count} zalijevanja`;
}

function weekMonthLabel(
    week: ReturnType<typeof buildHarvestTraceWateringGrid>[number],
    isFirstWeek: boolean,
) {
    const labelDay = week.days.find(
        (day) =>
            day.isInTraceRange && (isFirstWeek || day.date.getDate() === 1),
    );
    return labelDay ? monthFormatter.format(labelDay.date) : null;
}

export function HarvestTraceWateringGrid({
    timeline,
}: {
    timeline: HarvestTraceWateringGridItem[];
}) {
    const weeks = buildHarvestTraceWateringGrid(timeline);

    if (weeks.length === 0) {
        return null;
    }

    return (
        <div className="min-w-0 border-t pt-3">
            <div className="mb-2 flex items-center justify-between gap-3">
                <Typography
                    level="body3"
                    semiBold
                    className="text-muted-foreground"
                >
                    Dnevni ritam
                </Typography>
                <div
                    className="flex shrink-0 items-center gap-1 text-[0.65rem] text-muted-foreground"
                    aria-hidden
                >
                    <span>Manje</span>
                    {intensityClassNames.map((className) => (
                        <span
                            className={cx('size-3 rounded-[3px]', className)}
                            key={className}
                        />
                    ))}
                    <span>Više</span>
                </div>
            </div>

            <figure aria-label="Dnevni ritam zalijevanja biljke">
                <div className="overflow-x-auto pb-1">
                    <div className="w-max min-w-full">
                        <div className="mb-1 ml-8 flex gap-0.5" aria-hidden>
                            {weeks.map((week, weekIndex) => (
                                <span
                                    className="w-3 shrink-0 text-[0.6rem] leading-3 text-muted-foreground"
                                    key={week.key}
                                >
                                    {weekMonthLabel(week, weekIndex === 0)}
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <div
                                className="grid shrink-0 grid-rows-7 gap-0.5 text-[0.6rem] leading-3 text-muted-foreground"
                                aria-hidden
                            >
                                <span>Pon</span>
                                <span />
                                <span>Sri</span>
                                <span />
                                <span>Pet</span>
                                <span />
                                <span>Ned</span>
                            </div>
                            <div className="flex gap-0.5">
                                {weeks.map((week) => (
                                    <div
                                        className="grid shrink-0 grid-rows-7 gap-0.5"
                                        key={week.key}
                                    >
                                        {week.days.map((day) => {
                                            const label = `${accessibleDateFormatter.format(day.date)}: ${wateringCountLabel(day.count)}`;

                                            return (
                                                <span
                                                    aria-hidden={
                                                        day.isInTraceRange
                                                            ? undefined
                                                            : true
                                                    }
                                                    aria-label={
                                                        day.isInTraceRange
                                                            ? label
                                                            : undefined
                                                    }
                                                    className={cx(
                                                        'size-3 rounded-[3px]',
                                                        day.isInTraceRange
                                                            ? intensityClassNames[
                                                                  day.intensity
                                                              ]
                                                            : 'bg-transparent',
                                                    )}
                                                    key={day.key}
                                                    role="img"
                                                    title={
                                                        day.isInTraceRange
                                                            ? label
                                                            : undefined
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <figcaption className="sr-only">
                    Svaki kvadratić predstavlja jedan dan, a tamnija boja više
                    zalijevanja.
                </figcaption>
            </figure>
        </div>
    );
}
