'use client';

import type { PlantData } from '@gredice/client';
import { orderBy } from '@gredice/js/arrays';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { Fragment } from 'react';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import { plantMatchesSearch } from '../../lib/plants/plantSearch';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { KnownPages } from '../../src/KnownPages';
import { getCalendarRangePosition } from './calendarRangePosition';

const calendarMonths = [
    'I',
    'II',
    'III',
    'IV',
    'V',
    'VI',
    'VII',
    'VIII',
    'IX',
    'X',
    'XI',
    'XII',
];

const calendarActivityTypes = {
    propagating: {
        name: 'Sijanje unutra',
        color: 'bg-blue-400',
    },
    sowing: {
        name: 'Sijanje vani',
        color: 'bg-yellow-400',
    },
    planting: {
        name: 'Presađivanje',
        color: 'bg-amber-600',
    },
    harvest: {
        name: 'Berba',
        color: 'bg-lime-400',
    },
} as const;

export function PlantsCalendar({
    initialSearch = '',
    initialSeedTimeFilter = '',
    plants,
}: {
    initialSearch?: string;
    initialSeedTimeFilter?: string;
    plants: (PlantData & { isRecommended?: boolean })[] | undefined;
}) {
    const [search] = useClientSearchParam('pretraga', initialSearch);
    const [seedTimeFilter] = useClientSearchParam(
        'vrijemeZaSijanje',
        initialSeedTimeFilter,
    );
    const normalizedSearch = normalizeSearchText(search);
    const onlySeedTimePlants = seedTimeFilter === '1';
    const filteredPlants = orderBy(plants ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.name),
    )
        .filter((plant) => !onlySeedTimePlants || plant.isRecommended)
        .filter((plant) => plantMatchesSearch(plant, normalizedSearch))
        .map((plant) => ({ ...plant, id: plant.id.toString() }));

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-indexed
    const currentMonthProgress =
        currentDate.getDate() /
        new Date(currentDate.getFullYear(), currentMonth, 0).getDate();

    return (
        <div className="grid grid-cols-[260px_repeat(12,1fr)] text-sm rounded-lg overflow-x-auto relative">
            <div></div>
            {calendarMonths.map((month) => (
                <Typography
                    level="body2"
                    center
                    key={month}
                    className="py-2 text-center min-w-8 border-l"
                >
                    {month}
                </Typography>
            ))}
            {!filteredPlants.length && (
                <div className="col-span-full text-center py-4">
                    <Typography level="body2">
                        Nema rezultata pretrage.
                    </Typography>
                </div>
            )}
            {Object.entries(calendarActivityTypes).map(
                ([activityTypeName, activityType]) => {
                    return filteredPlants
                        .filter(
                            (p) =>
                                p.calendar &&
                                Object.keys(p.calendar).some(
                                    (a) => a === activityTypeName,
                                ),
                        )
                        .map((plant, plantIndex) => {
                            const activities = plant.calendar;
                            if (!activities) return null;

                            return (
                                <Fragment
                                    key={`${plant.id}-${activityTypeName}`}
                                >
                                    <Link
                                        href={KnownPages.Plant(
                                            plant.information.name,
                                        )}
                                        prefetch
                                    >
                                        <Row
                                            justifyContent="space-between"
                                            spacing={2}
                                            className="mx-2"
                                        >
                                            <Row spacing={2}>
                                                <PlantOrSortImage
                                                    plant={plant}
                                                    width={20}
                                                    height={20}
                                                />
                                                <Typography level="body2">
                                                    {plant.information.name}
                                                </Typography>
                                            </Row>
                                            <Row>
                                                {plantIndex === 0 && (
                                                    <Typography
                                                        level="body2"
                                                        title={
                                                            activityType.name
                                                        }
                                                        className="whitespace-nowrap"
                                                    >
                                                        {activityType.name}
                                                    </Typography>
                                                )}
                                                <div
                                                    className={`size-4 rounded-full inline-block ml-2 ${activityType.color}`}
                                                ></div>
                                            </Row>
                                        </Row>
                                    </Link>
                                    {calendarMonths.map((monthName, index) => {
                                        const month = index + 1;
                                        const currentActivities =
                                            activities[
                                                activityTypeName as keyof typeof calendarActivityTypes
                                            ];
                                        const position =
                                            getCalendarRangePosition(
                                                currentActivities,
                                                month,
                                            );

                                        return (
                                            <div
                                                key={monthName}
                                                className="relative border-l"
                                            >
                                                {position && (
                                                    <div
                                                        className={`absolute inset-y-1 -ml-[1px] ${activityType.color} ${position.isStart ? 'rounded-l-full' : ''} ${position.isEnd ? 'rounded-r-full' : ''}`}
                                                        style={{
                                                            left: position.left,
                                                            right: position.right,
                                                        }}
                                                    ></div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </Fragment>
                            );
                        });
                },
            )}
            <div className="grid grid-cols-subgrid [grid-column:2/-1] relative">
                <div
                    className="absolute bottom-0 w-0.5 bg-red-600"
                    style={{
                        top: `${-(Object.keys(calendarActivityTypes).length * filteredPlants.length + 1) * 20}px`,
                        left: `${((currentMonth + currentMonthProgress) / 12) * 100}%`,
                    }}
                />
            </div>
        </div>
    );
}
