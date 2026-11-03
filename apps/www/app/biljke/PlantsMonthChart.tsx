'use client';

import { Tabs, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useMemo } from 'react';
import { Card } from '../../components/shared/Card';
import {
    calendarMonthNames,
    calendarMonthShortNames,
} from '../../lib/plants/calendarActivities';
import { filterPlantArchive } from './plantArchiveFilter';
import type { PlantCatalogueItem } from './plantCatalogue';
import {
    formatPlantCount,
    parsePlantSeasonActivity,
    plantArchiveMonths,
    plantSeasonMonthCounts,
} from './plantSeason';
import {
    type PlantArchiveFilterDefaults,
    usePlantArchiveFilters,
} from './usePlantArchiveFilters';

export function PlantsMonthChart({
    className,
    filters,
    plants,
}: {
    className?: string;
    filters: PlantArchiveFilterDefaults;
    plants: PlantCatalogueItem[];
}) {
    const { activity, month, search, setActivity, setMonthFilter } =
        usePlantArchiveFilters(filters);
    const counts = useMemo(
        () =>
            plantSeasonMonthCounts(
                filterPlantArchive(plants, { activity, month: null, search })
                    .searched,
                activity,
            ),
        [activity, plants, search],
    );
    const maxCount = Math.max(1, ...counts);
    const title = `${activity === 'berba' ? 'Berba' : 'Sijanje'} po mjesecima`;

    return (
        <Card className={cx('flex flex-col gap-4 p-4 md:p-5', className)}>
            <h2 className="sr-only">{title}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Tabs
                    value={activity}
                    onValueChange={(value) =>
                        setActivity(parsePlantSeasonActivity(value))
                    }
                >
                    <TabsList className="border">
                        <TabsTrigger value="sijanje">Sijanje</TabsTrigger>
                        <TabsTrigger value="berba">Berba</TabsTrigger>
                    </TabsList>
                </Tabs>
                <span aria-hidden className="font-semibold">
                    po mjesecima
                </span>
                <Typography level="body3" className="ml-auto">
                    Broj biljaka
                </Typography>
            </div>
            <div className="grid min-h-36 flex-1 grid-cols-12 grid-rows-[minmax(0,1fr)] gap-0.5 sm:gap-1">
                {plantArchiveMonths.map((chartMonth, index) => {
                    const count = counts[index] ?? 0;
                    const isCurrent = chartMonth === filters.currentMonth;
                    const isSelected = chartMonth === month;
                    const shortName = calendarMonthShortNames[index] ?? '';
                    return (
                        <button
                            key={chartMonth}
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={`${calendarMonthNames[index]}${isCurrent ? ' (ovaj mjesec)' : ''}: ${formatPlantCount(count)} ${activity === 'berba' ? 'u berbi' : 'za sijanje'}`}
                            onClick={() =>
                                setMonthFilter(isSelected ? null : chartMonth)
                            }
                            className={cx(
                                'flex min-w-0 flex-col items-center gap-1.5 rounded-lg border-2 border-transparent px-0.5 pt-2 pb-1 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                                isCurrent &&
                                    'bg-green-100/80 hover:bg-green-100 dark:bg-green-950/50',
                                isSelected && 'border-foreground',
                            )}
                        >
                            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                {count}
                            </span>
                            <span className="flex min-h-14 w-full flex-1 items-end justify-center">
                                <span
                                    className={cx(
                                        'w-3/4 max-w-10 rounded-t-md rounded-b-sm',
                                        activity === 'berba'
                                            ? 'bg-lime-400'
                                            : 'bg-yellow-400',
                                        month !== null &&
                                            !isSelected &&
                                            'opacity-40',
                                    )}
                                    style={{
                                        height: `${Math.max(4, Math.round((count / maxCount) * 100))}%`,
                                    }}
                                />
                            </span>
                            <span
                                className={cx(
                                    'text-xs sm:text-sm',
                                    isCurrent
                                        ? 'font-bold text-green-800 dark:text-green-400'
                                        : 'font-medium',
                                )}
                            >
                                <span className="sm:hidden">
                                    {shortName.charAt(0)}
                                </span>
                                <span className="hidden sm:inline">
                                    {shortName}
                                </span>
                            </span>
                            <span className="h-3.5 text-[10px] font-bold uppercase leading-3.5 tracking-wide text-green-800 dark:text-green-400">
                                {isCurrent ? 'sada' : ''}
                            </span>
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}
