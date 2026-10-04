/** Strict local calendar date; never accepts JavaScript's overflow normalization. */
export function resolveGameProfileDate(
    value: string | undefined,
    fallback?: Date,
) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31)
        return fallback;
    const date = new Date(fallback ?? new Date(2000, 0, 1, 12));
    date.setFullYear(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    )
        return fallback;
    return date;
}

/** Transfer calendar/clock parts across RSC without imposing the server timezone. */
export function serializeGameProfileDate(date: Date | undefined) {
    if (!date) return undefined;
    const pad = (value: number, length = 2) =>
        String(value).padStart(length, '0');
    return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/** Called at a client boundary: ISO calendar parts without a zone mean browser-local time. */
export function restoreGameProfileDate(value: string | undefined) {
    return value ? new Date(value) : undefined;
}
