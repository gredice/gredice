import type { PlantData } from '@gredice/client';
import {
    calendarActivities,
    calendarActivityKeys,
} from '../../../lib/plants/calendarActivities';
import { PlantMonthCalendar } from '../PlantMonthCalendar';

export type PlantYearCalendarProps = {
    activities: PlantData['calendar'];
    now?: Date;
};

export function PlantYearCalendar({ activities, now }: PlantYearCalendarProps) {
    const rows = calendarActivityKeys
        .filter((activity) => activities[activity] !== undefined)
        .map((activity) => ({
            color: calendarActivities[activity].color,
            key: activity,
            label: calendarActivities[activity].shortName,
            title: calendarActivities[activity].name,
            ranges: activities[activity],
        }));

    return <PlantMonthCalendar rows={rows} now={now} />;
}
