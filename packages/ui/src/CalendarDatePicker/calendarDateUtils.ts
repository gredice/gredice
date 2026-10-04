const calendarDateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCalendarDateKey(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const match = calendarDateKeyPattern.exec(value);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

export function formatCalendarDateKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

export function startOfCalendarMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function addCalendarMonths(date: Date, months: number) {
    return new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
}

export function addCalendarDays(date: Date, days: number) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + days,
        12,
    );
}

export function calendarDateIsInRange(
    date: Date,
    minimumDate: Date | null,
    maximumDate: Date | null,
) {
    const dateKey = formatCalendarDateKey(date);
    const minimumDateKey = minimumDate
        ? formatCalendarDateKey(minimumDate)
        : null;
    const maximumDateKey = maximumDate
        ? formatCalendarDateKey(maximumDate)
        : null;

    return (
        (!minimumDateKey || dateKey >= minimumDateKey) &&
        (!maximumDateKey || dateKey <= maximumDateKey)
    );
}

export function getCalendarMonthCells(month: Date) {
    const firstDay = startOfCalendarMonth(month);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(
        firstDay.getFullYear(),
        firstDay.getMonth() + 1,
        0,
        12,
    ).getDate();

    return Array.from({ length: 42 }, (_, index) => {
        const dayOfMonth = index - mondayOffset + 1;
        if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
            return null;
        }

        return new Date(
            firstDay.getFullYear(),
            firstDay.getMonth(),
            dayOfMonth,
            12,
        );
    });
}

export function getInitialCalendarMonth({
    maximumDate,
    minimumDate,
    referenceDate,
    selectedDate,
}: {
    maximumDate: Date | null;
    minimumDate: Date | null;
    referenceDate: Date;
    selectedDate: Date | null;
}) {
    let candidate = selectedDate ?? referenceDate;

    if (
        minimumDate &&
        formatCalendarDateKey(candidate) < formatCalendarDateKey(minimumDate)
    ) {
        candidate = minimumDate;
    }

    if (
        maximumDate &&
        formatCalendarDateKey(candidate) > formatCalendarDateKey(maximumDate)
    ) {
        candidate = maximumDate;
    }

    return startOfCalendarMonth(candidate);
}
