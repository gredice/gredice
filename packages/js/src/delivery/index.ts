export interface FormatDeliveryWindowOptions {
    locale?: string;
    timeZone?: string;
}

function toDate(value: Date | string): Date {
    if (value instanceof Date) {
        return value;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date value provided: ${value}`);
    }
    return parsed;
}

function capitalize(value: string): string {
    if (!value) {
        return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Formats a delivery window using Croatian locale defaults.
 */
export function formatDeliveryWindow(
    start: Date | string,
    end: Date | string,
    {
        locale = 'hr-HR',
        timeZone = 'Europe/Zagreb',
    }: FormatDeliveryWindowOptions = {},
): string {
    const startDate = toDate(start);
    const endDate = toDate(end);

    const dateFormatter = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone,
    });
    const timeFormatter = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
    });

    const datePart = capitalize(dateFormatter.format(startDate));
    const startTime = timeFormatter.format(startDate);
    const endTime = timeFormatter.format(endDate);

    return `${datePart} od ${startTime} do ${endTime}`;
}
