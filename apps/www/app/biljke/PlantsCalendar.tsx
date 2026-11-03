'use client';

import { Chip } from '@gredice/ui/Chip';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Link from 'next/link';
import { useState } from 'react';
import {
    type CalendarActivity,
    calendarActivities,
    calendarActivityKeys,
    calendarMonthShortNames,
} from '../../lib/plants/calendarActivities';
import { KnownPages } from '../../src/KnownPages';
import { CalendarInfoChip } from './CalendarInfoChip';
import { getCalendarRangeSegments } from './calendarRangePosition';
import { filterPlantArchive } from './plantArchiveFilter';
import type { PlantCatalogueItem } from './plantCatalogue';
import { isPlantAvailableInStore, isPlantSowableInMonth } from './plantSeason';
import {
    type PlantArchiveFilterDefaults,
    usePlantArchiveFilters,
} from './usePlantArchiveFilters';

const laneTopPx = 5;
const laneStepPx = 8;

/** One row per plant, with a thin lane per activity, so a plant's year reads left to right. */
export function PlantsCalendar({
    filters,
    plants,
}: {
    filters: PlantArchiveFilterDefaults;
    plants: PlantCatalogueItem[];
}) {
    const { currentMonth } = filters;
    const { activity, month, search } = usePlantArchiveFilters(filters);
    const { filtered } = filterPlantArchive(plants, {
        activity,
        month,
        search,
    });
    const [hiddenActivities, setHiddenActivities] = useState<
        CalendarActivity[]
    >([]);
    const visibleActivities = calendarActivityKeys.filter(
        (key) => !hiddenActivities.includes(key),
    );
    const toggleActivity = (key: CalendarActivity) =>
        setHiddenActivities((current) =>
            current.includes(key)
                ? current.filter((hidden) => hidden !== key)
                : [...current, key],
        );

    return (
        <div className="text-sm">
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
                <Typography level="body2">Prikaži:</Typography>
                {calendarActivityKeys.map((key) => {
                    const isVisible = visibleActivities.includes(key);
                    return (
                        <Chip
                            key={key}
                            variant="outlined"
                            aria-pressed={isVisible}
                            onClick={() => toggleActivity(key)}
                            className={cx(
                                !isVisible && 'text-tertiary-foreground',
                            )}
                        >
                            <span
                                aria-hidden
                                className={cx(
                                    'h-1.5 w-4 rounded-full',
                                    isVisible
                                        ? calendarActivities[key].color
                                        : 'bg-tertiary',
                                )}
                            />
                            {calendarActivities[key].shortName}
                        </Chip>
                    );
                })}
                <CalendarInfoChip className="ml-auto" />
            </div>
            <div className="overflow-x-auto">
                <div className="relative min-w-[56rem]">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 right-0 left-64 grid grid-cols-12"
                    >
                        {calendarMonthShortNames.map((name, index) => (
                            <span
                                key={name}
                                className={cx(
                                    'border-l',
                                    index + 1 === currentMonth &&
                                        'bg-green-600/10',
                                )}
                            />
                        ))}
                    </div>
                    <div className="grid grid-cols-[16rem_minmax(0,1fr)] border-b">
                        <Typography
                            level="body3"
                            className="px-4 py-2.5 font-semibold"
                        >
                            Biljka
                        </Typography>
                        <div className="grid grid-cols-12">
                            {calendarMonthShortNames.map((name, index) => (
                                <Typography
                                    key={name}
                                    level="body3"
                                    center
                                    className={cx(
                                        'py-2.5',
                                        index + 1 === currentMonth
                                            ? 'font-bold text-green-800 dark:text-green-400'
                                            : 'font-medium',
                                    )}
                                >
                                    {name}
                                </Typography>
                            ))}
                        </div>
                    </div>
                    {filtered.length === 0 && (
                        <Typography level="body2" center className="py-4">
                            {month
                                ? 'Nema biljaka za ovaj odabir.'
                                : 'Nema rezultata pretrage.'}
                        </Typography>
                    )}
                    {filtered.map((plant) => {
                        const isAvailable = isPlantAvailableInStore(plant);
                        return (
                            <Link
                                key={plant.id}
                                href={KnownPages.Plant(plant.information.name)}
                                prefetch
                                className="relative grid grid-cols-[16rem_minmax(0,1fr)] border-b transition-colors last:border-b-0 hover:bg-muted/50"
                            >
                                <span className="flex min-w-0 items-center gap-2.5 px-4 py-1">
                                    <PlantOrSortImage
                                        plant={plant}
                                        width={28}
                                        height={28}
                                    />
                                    <span className="truncate font-medium">
                                        {plant.information.name}
                                    </span>
                                    {!isAvailable ? (
                                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                                            Nedostupno
                                        </span>
                                    ) : (
                                        isPlantSowableInMonth(
                                            plant,
                                            currentMonth,
                                        ) && (
                                            <span className="shrink-0 rounded-full bg-lime-100 px-2 py-0.5 text-[11px] font-semibold text-lime-800 dark:bg-lime-950 dark:text-lime-300">
                                                Sijanje sada
                                            </span>
                                        )
                                    )}
                                </span>
                                <span className="relative h-10">
                                    {visibleActivities.flatMap(
                                        (key, laneIndex) =>
                                            getCalendarRangeSegments(
                                                plant.calendar[key],
                                            ).map((segment) => (
                                                <span
                                                    key={`${key}-${segment.start}-${segment.width}`}
                                                    title={
                                                        calendarActivities[key]
                                                            .name
                                                    }
                                                    className={cx(
                                                        'absolute h-1.5 rounded-full',
                                                        calendarActivities[key]
                                                            .color,
                                                    )}
                                                    style={{
                                                        top:
                                                            laneTopPx +
                                                            laneIndex *
                                                                laneStepPx,
                                                        left: `${segment.start * 100}%`,
                                                        width: `${segment.width * 100}%`,
                                                    }}
                                                />
                                            )),
                                    )}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
