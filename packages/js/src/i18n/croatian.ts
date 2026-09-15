/**
 * Croatian pluralization and date-label utilities
 */

import { type DayKey, dayKeyToUtcDate } from '../dates';

export type CroatianPluralForms = {
    /** Used for 1, 21, 31, … */
    one: string;
    /** Used for 2-4, 22-24, … */
    few: string;
    /** Used for 0, 5-20, … */
    many: string;
};

/**
 * Picks the Croatian noun form matching a count.
 * @param count - Number the noun describes
 * @param forms - Noun forms for the Croatian plural categories
 */
export function croatianPlural(count: number, forms: CroatianPluralForms) {
    const absolute = Math.abs(count);
    const lastDigit = absolute % 10;
    const lastTwoDigits = absolute % 100;

    if (lastDigit === 1 && lastTwoDigits !== 11) {
        return forms.one;
    }

    if (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        (lastTwoDigits < 12 || lastTwoDigits > 14)
    ) {
        return forms.few;
    }

    return forms.many;
}

/**
 * Formats delivery count in Croatian with proper pluralization
 * @param count - Number of deliveries
 * @param includeVerb - Whether to include the verb form (bila je/bile su/bilo je)
 * @returns Formatted string in Croatian
 */
export function formatDeliveryCount(
    count: number,
    includeVerb = false,
): string {
    const noun = getDeliveryNoun(count);

    if (!includeVerb) {
        return `${count} ${noun}`;
    }

    const verb = getDeliveryVerb(count);
    return `${verb} ${count} ${noun}`;
}

/**
 * Gets the correct Croatian noun form for "dostava" based on count
 */
function getDeliveryNoun(count: number): string {
    if (count === 1) {
        return 'dostava';
    }

    if (count >= 2 && count <= 4) {
        return 'dostave';
    }

    return 'dostava';
}

/**
 * Gets the correct Croatian verb form for deliveries based on count
 */
function getDeliveryVerb(count: number): string {
    if (count === 1) {
        return 'bila je';
    }

    if (count >= 2 && count <= 4) {
        return 'bile su';
    }

    return 'bilo je';
}

const dayLabelFormat = new Intl.DateTimeFormat('hr-HR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

const currentYearDayLabelFormat = new Intl.DateTimeFormat('hr-HR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
});

/**
 * Renders a day key as a Croatian date. The year is only spelled out when the
 * day falls outside `currentYear`, keeping recent dates short.
 */
export function croatianDayLabel(
    dayKey: DayKey,
    currentYear = new Date().getFullYear(),
) {
    const date = dayKeyToUtcDate(dayKey);

    if (!date) {
        return 'Bez datuma';
    }

    return date.getUTCFullYear() === currentYear
        ? currentYearDayLabelFormat.format(date)
        : dayLabelFormat.format(date);
}
