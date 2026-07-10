const calendarDateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function calendarDateParts(dateKey: string) {
    const match = calendarDateKeyPattern.exec(dateKey);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return { day, month, year };
}

export function isCalendarDateKey(dateKey: string) {
    return calendarDateParts(dateKey) !== null;
}

export function getTimeZoneDateKey(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(dateKey: string, days: number) {
    const parts = calendarDateParts(dateKey);
    if (!parts || !Number.isInteger(days)) {
        throw new Error('Invalid calendar date or day offset.');
    }

    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export function calendarDateKeyToUtcDate(dateKey: string) {
    const parts = calendarDateParts(dateKey);
    if (!parts) {
        throw new Error('Invalid calendar date.');
    }

    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function zonedCalendarDateStart(dateKey: string, timeZone: string) {
    const parts = calendarDateParts(dateKey);
    if (!parts) {
        throw new Error('Invalid calendar date.');
    }

    const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
    let utc = targetUtc;

    for (let index = 0; index < 4; index += 1) {
        const formattedParts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(new Date(utc));
        const values = Object.fromEntries(
            formattedParts.map((part) => [part.type, part.value]),
        );
        const renderedUtc = Date.UTC(
            Number(values.year),
            Number(values.month) - 1,
            Number(values.day),
            Number(values.hour),
            Number(values.minute),
            Number(values.second),
        );
        const difference = targetUtc - renderedUtc;

        if (difference === 0) {
            break;
        }

        utc += difference;
    }

    return new Date(utc);
}

export function getTimeZoneDayRange(dateKey: string, timeZone: string) {
    const from = zonedCalendarDateStart(dateKey, timeZone);
    const nextDayStart = zonedCalendarDateStart(
        addCalendarDays(dateKey, 1),
        timeZone,
    );

    return {
        from,
        to: new Date(nextDayStart.getTime() - 1),
    };
}

/**
 * Check if the current hour in a timezone matches the target hour.
 * @param timeZone - IANA timezone string (e.g., 'Europe/Paris')
 * @param targetHour - The target hour (0-23)
 * @param now - Optional date to use instead of current time (for testing)
 * @returns true if the current hour in the timezone matches the target hour
 */
export function isTargetHourInTimeZone(
    timeZone: string,
    targetHour: number,
    now: Date = new Date(),
): boolean {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            hour12: false,
        });
        const currentHour = Number.parseInt(formatter.format(now), 10);
        return currentHour === targetHour;
    } catch {
        // If timezone is invalid, default to Europe/Paris
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Paris',
            hour: 'numeric',
            hour12: false,
        });
        const currentHour = Number.parseInt(formatter.format(now), 10);
        return currentHour === targetHour;
    }
}
