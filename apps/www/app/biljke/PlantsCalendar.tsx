'use client';

import { PlantData } from "./[alias]/page";
import { CSSProperties, Fragment } from "react";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { orderBy } from "@signalco/js";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import Link from "next/link";
import { KnownPages } from "../../src/KnownPages";
import { PlantImage } from "../../components/plants/PlantImage";

export const revalidate = 3600; // 1 hour
export const dynamicParams = true;

const calendarMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

const calendarActivityTypes = {
    sowing: {
        name: 'Sijanje',
        color: 'bg-yellow-400'
    },
    propagating: {
        name: 'Uzgoj',
        color: 'bg-blue-400'
    },
    planting: {
        name: 'Sadnja',
        color: 'bg-amber-600'
    },
    harvest: {
        name: 'Branje',
        color: 'bg-lime-400'
    }
} as const;

export function PlantsCalendar({ plants }: { plants: PlantData[] }) {
    const [search] = useSearchParam('pretraga');
    const filteredPlants = orderBy(plants, (a, b) => a.information.name.localeCompare(b.information.name))
        .filter(plant => !search || plant.information.name.toLowerCase().includes(search.toLowerCase()))
        .map(plant => ({ ...plant, id: plant.id.toString() }));

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() // 0-indexed
    const currentMonthProgress = currentDate.getDate() / new Date(currentDate.getFullYear(), currentMonth, 0).getDate();

    return (
        <div className="grid grid-cols-[200px_repeat(12,1fr)] text-sm rounded-lg overflow-x-auto relative">
            <div></div>
            {calendarMonths.map((month, monthIndex) => (
                <Typography level="body2" center key={monthIndex} className="py-2 text-center min-w-8 border-l">
                    {month}
                </Typography>
            ))}
            {!filteredPlants.length && (
                <div className="col-span-full text-center py-4">
                    <Typography level="body2">Nema rezultata pretrage.</Typography>
                </div>
            )}
            {Object.keys(calendarActivityTypes).map((activityTypeName) => {
                const activityType = calendarActivityTypes[activityTypeName as keyof typeof calendarActivityTypes];
                return filteredPlants
                    .filter(p => p.calendar && Object.keys(p.calendar).some(a => a === activityTypeName))
                    .map((plant, plantIndex) => {
                        const activities = plant.calendar;
                        if (!activities) return null;

                        return (
                            <Fragment key={`${plant.id}-${activityTypeName}`}>
                                <Link href={KnownPages.Plant(plant.information.name)} prefetch>
                                    <Row justifyContent="space-between" spacing={1} className="mx-2">
                                        <Row spacing={1}>
                                            <PlantImage plant={plant} width={20} height={20} />
                                            <Typography level="body2">
                                                {plant.information.name}
                                            </Typography>
                                        </Row>
                                        <Row>
                                            {plantIndex === 0 && (
                                                <Typography level="body2">
                                                    {activityType.name}
                                                </Typography>
                                            )}
                                            <div className={`size-4 rounded-full inline-block ml-2 ${activityType.color}`}></div>
                                        </Row>
                                    </Row>
                                </Link>
                                {calendarMonths.map((_, index) => {
                                    const month = index + 1;
                                    const currentActivities = activities[activityTypeName];
                                    const currentMonthActivities = currentActivities.filter(a => month >= Math.floor(a.start) && month <= Math.floor(a.end));
                                    const minStart = Math.min(...currentMonthActivities.map(a => a.start % 1));
                                    const maxEnd = Math.max(...currentMonthActivities.map(a => a.end % 1));
                                    const isActivityActive = currentMonthActivities.length > 0;
                                    const isActivityStart = currentActivities.some(a => month === Math.floor(a.start));
                                    const isActivityEnd = currentActivities.some(a => month === Math.floor(a.end));

                                    return (
                                        <div key={index} className="relative border-l">
                                            {isActivityActive && (
                                                <div
                                                    className={`absolute inset-y-1 left-[--activity-left] -ml-[1px] right-[--activity-right] ${activityType.color} ${isActivityStart ? 'rounded-l-full' : ''} ${isActivityEnd ? 'rounded-r-full' : ''}`}
                                                    style={{
                                                        '--activity-left': isActivityStart ? `${(minStart) * 100}%` : '0px',
                                                        '--activity-right': isActivityEnd ? `${Math.min(75, (1 - maxEnd) * 100)}%` : '0px'
                                                    } as CSSProperties}
                                                ></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </Fragment>
                        );
                    });
            })}
            <div className="grid grid-cols-subgrid [grid-column:2/-1] relative">
                <div
                    className="absolute bottom-0 w-0.5 bg-red-600"
                    style={{
                        top: `${-(Object.keys(calendarActivityTypes).length * plants.length + 1) * 20}px`,
                        left: `${((currentMonth + currentMonthProgress) / 12) * 100}%`
                    }}
                />
            </div>
        </div>
    )
}