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
