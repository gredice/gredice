import type { PublicGardenResponse } from '@gredice/client';

const gardenDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
});

const gardenNumberFormatter = new Intl.NumberFormat('hr-HR');

export function countActivePlantsFromPublicGarden(
    garden: PublicGardenResponse,
) {
    return garden.raisedBeds.reduce(
        (total, raisedBed) =>
            total +
            raisedBed.fields.filter(
                (field) =>
                    field.active && typeof field.plantSortId === 'number',
            ).length,
        0,
    );
}

export function formatGardenDate(value: Date | string) {
    return gardenDateFormatter.format(new Date(value));
}

export function formatGardenNumber(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
    }

    return gardenNumberFormatter.format(value);
}
