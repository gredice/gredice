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
