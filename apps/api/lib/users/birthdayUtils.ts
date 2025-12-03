export const MIN_BIRTH_YEAR = 1900;

export interface BirthdayInput {
    day: number;
    month: number;
    year?: number | null;
}

export function isLeapYear(year: number) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isValidBirthday({ day, month, year }: BirthdayInput) {
    if (!Number.isInteger(day) || !Number.isInteger(month)) {
        return false;
    }
    if (month < 1 || month > 12) {
        return false;
    }
    if (day < 1) {
        return false;
    }
    const maxDay = getDaysInMonth(month, year ?? undefined);
    if (day > maxDay) {
        return false;
    }
    if (typeof year === 'number') {
        const currentYear = new Date().getUTCFullYear();
        if (year < MIN_BIRTH_YEAR || year > currentYear) {
            return false;
        }
    }
    return true;
}

export function getDaysInMonth(month: number, year?: number) {
    if (typeof year === 'number') {
        return new Date(Date.UTC(year, month, 0)).getUTCDate();
    }
    if (month === 2) {
        return 29;
    }
    if (month === 4 || month === 6 || month === 9 || month === 11) {
        return 30;
    }
    return 31;
}

export function getBirthdayDateForYear(
    month: number,
    day: number,
    year: number,
) {
    if (month === 2 && day === 29 && !isLeapYear(year)) {
        return new Date(Date.UTC(year, 1, 28));
    }
    return new Date(Date.UTC(year, month - 1, day));
}

export function startOfUtcDay(date: Date) {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
}

export function getLastBirthdayOccurrence(
    month: number,
    day: number,
    referenceDate: Date,
) {
    const referenceDay = startOfUtcDay(referenceDate);
    let candidate = getBirthdayDateForYear(
        month,
        day,
        referenceDay.getUTCFullYear(),
    );
    if (candidate > referenceDay) {
        candidate = getBirthdayDateForYear(
            month,
            day,
            referenceDay.getUTCFullYear() - 1,
        );
    }
    return candidate;
}

export function getBirthdayDateForCurrentYear(
    month: number,
    day: number,
    referenceDate: Date,
) {
    return getBirthdayDateForYear(
        month,
        day,
        startOfUtcDay(referenceDate).getUTCFullYear(),
    );
}

export function differenceInCalendarDays(a: Date, b: Date) {
    const first = startOfUtcDay(a);
    const second = startOfUtcDay(b);
    const diff = first.getTime() - second.getTime();
    return Math.round(diff / (24 * 60 * 60 * 1000));
}
