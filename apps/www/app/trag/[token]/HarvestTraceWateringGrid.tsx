import { Card } from '@gredice/ui/Card';
import { Droplets } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
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
        <Card className="overflow-hidden bg-card p-4 sm:p-5">
            <Stack spacing={4}>
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                        <Droplets className="size-4" />
                    </span>
                    <Stack spacing={1} className="min-w-0">
                        <Typography level="h3" className="text-xl">
                            Ritam zalijevanja
                        </Typography>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Svaki kvadratić predstavlja jedan dan, a tamnija
                            boja više zalijevanja.
                        </Typography>
                    </Stack>
                </div>

                <figure aria-label="Dnevni ritam zalijevanja biljke">
                    <div className="overflow-x-auto pb-1">
                        <div className="w-max min-w-full">
                            <div className="mb-1 ml-8 flex gap-1" aria-hidden>
                                {weeks.map((week, weekIndex) => (
                                    <span
                                        className="w-3.5 shrink-0 text-[0.65rem] leading-4 text-muted-foreground"
                                        key={week.key}
                                    >
                                        {weekMonthLabel(week, weekIndex === 0)}
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <div
                                    className="grid shrink-0 grid-rows-7 gap-1 text-[0.65rem] leading-[0.875rem] text-muted-foreground"
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
                                <div className="flex gap-1">
                                    {weeks.map((week) => (
                                        <div
                                            className="grid shrink-0 grid-rows-7 gap-1"
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
                                                            'size-3.5 rounded-[3px]',
                                                            day.isInTraceRange
                                                                ? intensityClassNames[
                                                                      day
                                                                          .intensity
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

                    <figcaption className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                        <span>Manje</span>
                        {intensityClassNames.map((className) => (
                            <span
                                aria-hidden
                                className={cx(
                                    'size-3.5 rounded-[3px]',
                                    className,
                                )}
                                key={className}
                            />
                        ))}
                        <span>Više</span>
                    </figcaption>
                </figure>
            </Stack>
        </Card>
    );
}
