import { getCalendarRangePosition } from './calendarRangePosition';
import type { PlantCatalogueItem } from './plantCatalogue';

export type PlantSeasonActivity = 'sijanje' | 'berba';

/** Anchor for the toolbar above the results, used when a season shortcut filters the list. */
export const plantArchiveResultsId = 'popis-biljaka';

export const plantArchiveMonths = Array.from(
    { length: 12 },
    (_, index) => index + 1,
);

type PlantSeasonSource = Pick<PlantCatalogueItem, 'calendar'>;

/** "1 biljka", "3 biljke", "29 biljaka". */
export function formatPlantCount(count: number) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastDigit === 1 && lastTwoDigits !== 11) {
        return `${count} biljka`;
    }
    if (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        (lastTwoDigits < 12 || lastTwoDigits > 14)
    ) {
        return `${count} biljke`;
    }
    return `${count} biljaka`;
}

/**
 * Month-level membership, matching the calendar bars: a sowing or
 * propagating window that starts mid-month (e.g. 3.5) counts for that month,
 * and windows that run past December wrap.
 */
export function isPlantSowableInMonth(plant: PlantSeasonSource, month: number) {
    return (
        getCalendarRangePosition(plant.calendar.sowing, month) !== null ||
        getCalendarRangePosition(plant.calendar.propagating, month) !== null
    );
}

export function isPlantHarvestedInMonth(
    plant: PlantSeasonSource,
    month: number,
) {
    return getCalendarRangePosition(plant.calendar.harvest, month) !== null;
}

export function isPlantInSeason(
    plant: PlantSeasonSource,
    activity: PlantSeasonActivity,
    month: number,
) {
    return activity === 'berba'
        ? isPlantHarvestedInMonth(plant, month)
        : isPlantSowableInMonth(plant, month);
}

export function plantSeasonMonthCounts(
    plants: readonly PlantSeasonSource[],
    activity: PlantSeasonActivity,
) {
    return plantArchiveMonths.map(
        (month) =>
            plants.filter((plant) => isPlantInSeason(plant, activity, month))
                .length,
    );
}

export function parsePlantArchiveMonth(value: string | undefined | null) {
    const month = Number(value);
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

export function parsePlantSeasonActivity(
    value: string | undefined | null,
): PlantSeasonActivity {
    return value === 'berba' ? 'berba' : 'sijanje';
}

function nextMonth(month: number) {
    return (month % 12) + 1;
}

function previousMonth(month: number) {
    return ((month + 10) % 12) + 1;
}

/** "last": the sowing window closes this month; "first": it opens this month. */
export function plantSowingWindowEdge(
    plant: PlantSeasonSource,
    month: number,
): 'last' | 'first' | null {
    if (!isPlantSowableInMonth(plant, month)) {
        return null;
    }
    if (!isPlantSowableInMonth(plant, nextMonth(month))) {
        return 'last';
    }
    if (!isPlantSowableInMonth(plant, previousMonth(month))) {
        return 'first';
    }
    return null;
}

export function isPlantAvailableInStore(
    plant: Pick<PlantCatalogueItem, 'store'>,
) {
    return plant.store?.availableInStore !== false;
}

/**
 * Busy months have dozens of sowable plants, so the season panel leads with
 * the ones whose window closes this month, then the ones that just opened.
 */
export function rankSowablePlants<
    TPlant extends PlantSeasonSource & Pick<PlantCatalogueItem, 'store'>,
>(
    plants: readonly TPlant[],
    month: number,
    compareNames: (a: TPlant, b: TPlant) => number,
) {
    const rank = (plant: TPlant) => {
        if (!isPlantAvailableInStore(plant)) {
            return 3;
        }
        const edge = plantSowingWindowEdge(plant, month);
        return edge === 'last' ? 0 : edge === 'first' ? 1 : 2;
    };
    return plants
        .filter((plant) => isPlantSowableInMonth(plant, month))
        .sort((a, b) => rank(a) - rank(b) || compareNames(a, b));
}
