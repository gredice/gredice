import { createHash } from 'node:crypto';
import type { PlantData, PlantSortData } from '@gredice/directory-types';
import {
    type CalendarRangeInput,
    getCalendarRangePosition,
} from '../../app/biljke/calendarRangePosition.ts';
import { toPageAlias } from '../../src/pageAliases.ts';
import {
    calendarActivities,
    calendarActivityKeys,
    calendarMonthNames,
} from './calendarActivities.ts';
import {
    type RegionalCalendarReview,
    regionalCalendarPilotSlugs,
    regionalCalendarRegion,
} from './regionalCalendarReviews.ts';
import { resolvePlantSowingPrice } from './resolvePlantSowingPrice.ts';

type CalendarPlant = Pick<PlantData, 'id'> & {
    information: Pick<PlantData['information'], 'name'>;
    calendar: Partial<
        Record<keyof PlantData['calendar'], readonly CalendarRangeInput[]>
    >;
    prices?: PlantData['prices'];
};
type CalendarSort = Pick<PlantSortData, 'id' | 'store'> & {
    information: Pick<PlantSortData['information'], 'name'> & {
        plant?: Pick<PlantData, 'id'>;
    };
    prices?: PlantData['prices'];
};

function boundary(value: CalendarRangeInput['start']) {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 1 && number < 13
        ? number
        : null;
}

function normalizedRanges(ranges: readonly CalendarRangeInput[] | undefined) {
    return (ranges ?? []).map((range) => ({
        start: boundary(range.start),
        end: boundary(range.end),
    }));
}

export function getRegionalCalendarDigest(calendar: CalendarPlant['calendar']) {
    return createHash('sha256')
        .update(
            JSON.stringify(
                calendarActivityKeys.map((activity) => [
                    activity,
                    normalizedRanges(calendar?.[activity]),
                ]),
            ),
        )
        .digest('hex');
}

function isDate(value: string) {
    return (
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value
    );
}

function isPublicSource(source: RegionalCalendarReview['sources'][number]) {
    try {
        const url = new URL(source.url);
        return (
            Boolean(source.label.trim()) &&
            url.protocol === 'https:' &&
            !url.username &&
            !url.password
        );
    } catch {
        return false;
    }
}

function reviewStatus(
    plant: CalendarPlant,
    review: RegionalCalendarReview | undefined,
    today: string,
) {
    if (!review) return 'missing';
    if (
        review.region !== regionalCalendarRegion ||
        !review.reviewer.name.trim() ||
        !review.reviewer.role.trim() ||
        !isDate(review.reviewedAt) ||
        !isDate(review.reviewBefore) ||
        review.reviewedAt > today ||
        review.reviewBefore <= review.reviewedAt ||
        !review.sources.length ||
        !review.sources.every(isPublicSource) ||
        calendarActivityKeys.some((activity) => {
            const context = review.activities[activity];
            return (
                context !== null &&
                (!context?.varietyNotes.trim() ||
                    !['outdoors', 'protected'].includes(context.environment) ||
                    (activity !== 'harvest' &&
                        context.environment !==
                            (activity === 'propagating'
                                ? 'protected'
                                : 'outdoors')) ||
                    !context.rangeIndexes.length ||
                    context.rangeIndexes.some((index) => {
                        const range = normalizedRanges(
                            plant.calendar?.[activity],
                        )[index];
                        return (
                            !Number.isInteger(index) ||
                            !range ||
                            range.start === null ||
                            range.end === null
                        );
                    }))
            );
        })
    )
        return 'incomplete';
    if (review.calendarDigest !== getRegionalCalendarDigest(plant.calendar)) {
        return 'changed';
    }
    if (review.reviewBefore <= today) return 'expired';
    return 'reviewed';
}

export function formatCalendarPeriod(ranges: readonly CalendarRangeInput[]) {
    const format = (value: CalendarRangeInput['start']) => {
        const number = boundary(value);
        if (number === null) return '';
        const fraction = number % 1;
        const month =
            calendarMonthNames[Math.floor(number) - 1].toLocaleLowerCase('hr');
        if (fraction === 0) return month;
        return `${month} (${Math.round(fraction * 100)} % mjeseca)`;
    };
    return ranges
        .map((range) => `${format(range.start)} – ${format(range.end)}`)
        .join('; ');
}

export function buildRegionalCalendar(
    plants: readonly CalendarPlant[],
    sorts: readonly CalendarSort[],
    reviews: readonly RegionalCalendarReview[],
    today: string,
) {
    const crops = regionalCalendarPilotSlugs.flatMap((slug) => {
        const plant = plants.find(
            (candidate) => toPageAlias(candidate.information.name) === slug,
        );
        if (!plant) return [];
        const review = reviews.find(
            (candidate) => candidate.plantId === plant.id,
        );
        const status = reviewStatus(plant, review, today);
        const currentReview = status === 'reviewed' ? review : undefined;
        const rows = calendarActivityKeys.map((activity) => {
            const context = currentReview?.activities[activity];
            const sourceRanges = normalizedRanges(plant.calendar?.[activity]);
            const ranges =
                context?.rangeIndexes.flatMap((index) => {
                    const range = sourceRanges[index];
                    return range && range.start !== null && range.end !== null
                        ? [{ start: range.start, end: range.end }]
                        : [];
                }) ?? [];
            return {
                key: `${plant.id}-${activity}`,
                plantId: plant.id,
                slug,
                plantName: plant.information.name,
                activity,
                label:
                    slug === 'cesnjak' && activity === 'sowing'
                        ? 'Sadnja češnjeva'
                        : calendarActivities[activity].name,
                color: calendarActivities[activity].color,
                environment:
                    context?.environment === 'outdoors'
                        ? 'Na otvorenom'
                        : context?.environment === 'protected'
                          ? 'Zaštićeni prostor'
                          : 'Nije potvrđeno',
                varietyNotes:
                    context?.varietyNotes ??
                    'Nema potvrđene preporuke za sortu i uvjete uzgoja.',
                ranges,
                months: calendarMonthNames.map((_, index) =>
                    Boolean(getCalendarRangePosition(ranges, index + 1)),
                ),
                period: ranges.length
                    ? formatCalendarPeriod(ranges)
                    : 'Nije navedeno',
            };
        });
        const plantSorts = sorts.filter(
            (sort) => sort.information.plant?.id === plant.id,
        );
        const availableSorts = plantSorts.filter((sort) => {
            const price = resolvePlantSowingPrice(plant, sort)?.currentPrice;
            return (
                sort.store?.availableInStore === true &&
                typeof price === 'number' &&
                Number.isFinite(price) &&
                price >= 0
            );
        });
        return [
            {
                plantId: plant.id,
                slug,
                name: plant.information.name,
                status,
                review: currentReview,
                rows,
                availableSorts: availableSorts.map((sort) => ({
                    id: sort.id,
                    name: sort.information.name,
                })),
            },
        ];
    });
    return {
        crops,
        rows: crops.flatMap((crop) => crop.rows),
        ready:
            crops.length === regionalCalendarPilotSlugs.length &&
            crops.every(
                (crop) =>
                    crop.status === 'reviewed' &&
                    crop.rows.some((row) => row.ranges.length > 0),
            ),
    };
}

export type RegionalCalendarRow = ReturnType<
    typeof buildRegionalCalendar
>['rows'][number];

export function filterRegionalCalendarRows(
    rows: readonly RegionalCalendarRow[],
    { month, activity }: { month: string; activity: string },
) {
    const monthNumber = Number(month);
    const validMonth =
        Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12;
    return rows.filter(
        (row) =>
            (!activity || row.activity === activity) &&
            (!validMonth || row.months[monthNumber - 1]),
    );
}
