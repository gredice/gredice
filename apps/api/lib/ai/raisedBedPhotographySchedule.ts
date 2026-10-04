import { TZDate, tz } from '@date-fns/tz';

export const GARDEN_SCHEDULE_TIME_ZONE = 'Europe/Zagreb';

/**
 * Raised beds are photographed twice a week. The photography operations are
 * created by the `Dodaj fotografiranje aktivnih gredica` automation, which
 * schedules them for every Tuesday and Friday.
 */
export const RAISED_BED_PHOTOGRAPHY_WEEKDAYS = [2, 5] as const;
export const RAISED_BED_PHOTOGRAPHY_WEEKDAY_LABELS = [
    'utorak',
    'petak',
] as const;
export const RAISED_BED_PHOTOGRAPHY_TIMES_PER_WEEK =
    RAISED_BED_PHOTOGRAPHY_WEEKDAYS.length;
export const RAISED_BED_PHOTOGRAPHY_SCHEDULE_DESCRIPTION =
    'Gredice fotografiramo dva puta tjedno, utorkom i petkom. Nove fotografije i dnevnički unosi stižu tim danima.';

const NEXT_PHOTOGRAPHY_DATE_COUNT = 3;
const PHOTOGRAPHY_LOOKAHEAD_DAYS = 14;

export function formatGardenScheduleDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function gardenScheduleLocalDate(date: Date, dayOffset = 0) {
    const localDate = tz(GARDEN_SCHEDULE_TIME_ZONE)(date);

    return new TZDate(
        localDate.getFullYear(),
        localDate.getMonth(),
        localDate.getDate() + dayOffset,
        0,
        0,
        0,
        0,
        GARDEN_SCHEDULE_TIME_ZONE,
    );
}

/**
 * Upcoming Zagreb-local dates on which raised beds get photographed. The
 * reference day is included when it is a photography day, because the photos
 * of that day can still arrive.
 */
export function getNextRaisedBedPhotographyDates(
    referenceDate = new Date(),
    count = NEXT_PHOTOGRAPHY_DATE_COUNT,
) {
    const dates: string[] = [];

    for (
        let dayOffset = 0;
        dates.length < count && dayOffset < PHOTOGRAPHY_LOOKAHEAD_DAYS;
        dayOffset++
    ) {
        const date = gardenScheduleLocalDate(referenceDate, dayOffset);
        if (
            RAISED_BED_PHOTOGRAPHY_WEEKDAYS.some(
                (weekday) => weekday === date.getDay(),
            )
        ) {
            dates.push(formatGardenScheduleDateKey(date));
        }
    }

    return dates;
}

export function buildRaisedBedPhotographyScheduleContext(
    referenceDate = new Date(),
) {
    return {
        timesPerWeek: RAISED_BED_PHOTOGRAPHY_TIMES_PER_WEEK,
        weekdays: [...RAISED_BED_PHOTOGRAPHY_WEEKDAY_LABELS],
        timeZone: GARDEN_SCHEDULE_TIME_ZONE,
        upcomingPhotographyDates:
            getNextRaisedBedPhotographyDates(referenceDate),
        description: RAISED_BED_PHOTOGRAPHY_SCHEDULE_DESCRIPTION,
    };
}
