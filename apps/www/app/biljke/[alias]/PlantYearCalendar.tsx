import type { PlantData } from '@gredice/client';
import { PlantMonthCalendar } from '../PlantMonthCalendar';

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

export type PlantYearCalendarProps = {
    activities: PlantData['calendar'];
    now?: Date;
};

export function PlantYearCalendar({ activities, now }: PlantYearCalendarProps) {
    const rows = Object.entries(calendarActivityTypes)
        .filter(([activityTypeName]) =>
            Object.keys(activities).some((name) => name === activityTypeName),
        )
        .map(([activityTypeName, activityType]) => ({
            color: activityType.color,
            key: activityTypeName,
            label: activityType.name,
            ranges: activities[
                activityTypeName as keyof typeof calendarActivityTypes
            ],
        }));

    return <PlantMonthCalendar rows={rows} now={now} />;
}
