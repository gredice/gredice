import type { PlantData } from '@gredice/client';

type PlantCalendarRange = {
    start: number;
    end: number;
};

function calendarMonthPosition(date: Date) {
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const month = date.getMonth() + 1;
    const daysInMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
    ).getDate();

    return month + (date.getDate() - 1) / daysInMonth;
}

function normalizedCalendarBoundary(value: number, endBoundary: boolean) {
    if (!Number.isFinite(value) || value < 1 || value > 12.99) {
        return null;
    }

    if (endBoundary && Number.isInteger(value)) {
        return Math.min(12.99, value + 0.99);
    }

    return value;
}

function isDateWithinCalendarRange(date: Date, range: PlantCalendarRange) {
    const datePosition = calendarMonthPosition(date);
    const start = normalizedCalendarBoundary(range.start, false);
    const end = normalizedCalendarBoundary(range.end, true);
    if (datePosition === null || start === null || end === null) {
        return false;
    }

    return start <= end
        ? datePosition >= start && datePosition <= end
        : datePosition >= start || datePosition <= end;
}

export function isGreenhouseSowingRecommended(
    plant: Pick<PlantData, 'calendar'> | null | undefined,
    sowingDate: Date,
) {
    return Boolean(
        plant?.calendar.propagating?.some((range) =>
            isDateWithinCalendarRange(sowingDate, range),
        ),
    );
}
