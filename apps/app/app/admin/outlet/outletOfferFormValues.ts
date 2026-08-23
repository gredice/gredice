import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';

export type OutletOfferFormInitialValues = {
    plantSortId?: string;
    status: string;
    outletPrice: string;
    comparePrice: string;
    comparePriceCents: number | null;
    quantity: number;
    initialPlantStatus: string;
    sowingDate: string;
    startAt: string;
    endAt: string;
};

export type OutletOfferPlantSortItem = {
    value: string;
    label: string;
    comparePriceValue: string;
};

const hourMs = 60 * 60 * 1000;
const dayHours = 24;

export function plantSortLabel(plantSort: EntityStandardized) {
    return (
        plantSort.information?.label ??
        plantSort.information?.name ??
        `Sorta ${plantSort.id}`
    );
}

export function priceInputValue(cents: number | null | undefined) {
    if (typeof cents !== 'number') {
        return '';
    }

    return (cents / 100).toFixed(2);
}

function plantSortComparePriceCents(plantSort: EntityStandardized) {
    const price = plantSort.prices?.perPlant;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        return null;
    }

    return Math.round(price * 100);
}

export function outletPlantSortFormItems(
    plantSorts: EntityStandardized[],
): OutletOfferPlantSortItem[] {
    return plantSorts.map((plantSort) => ({
        value: plantSort.id.toString(),
        label: plantSortLabel(plantSort),
        comparePriceValue: priceInputValue(
            plantSortComparePriceCents(plantSort),
        ),
    }));
}

function hourUnit(value: number) {
    if (value === 1) {
        return 'sat';
    }

    const lastDigit = value % 10;
    const lastTwoDigits = value % 100;
    if (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        (lastTwoDigits < 12 || lastTwoDigits > 14)
    ) {
        return 'sata';
    }

    return 'sati';
}

function durationText(totalHours: number) {
    const days = Math.floor(totalHours / dayHours);
    const hours = totalHours % dayHours;
    const parts: string[] = [];

    if (days > 0) {
        parts.push(`${days} ${days === 1 ? 'dan' : 'dana'}`);
    }

    if (hours > 0) {
        parts.push(`${hours} ${hourUnit(hours)}`);
    }

    return parts.join(' i ');
}

export function formatEndAtOffset(endAtValue: string, now = new Date()) {
    const endAt = new Date(endAtValue);
    if (!endAtValue || Number.isNaN(endAt.getTime())) {
        return 'Unesite kraj ponude.';
    }

    const diffMs = endAt.getTime() - now.getTime();
    if (diffMs < 0) {
        return 'Kraj ponude je prošao.';
    }

    if (diffMs < hourMs) {
        return 'Kraj ponude je za manje od 1 sata.';
    }

    return `Kraj ponude je za ${durationText(
        Math.ceil(diffMs / hourMs),
    )} od sada.`;
}
