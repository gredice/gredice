export function normalizeNewsFilterValue(value: string | undefined) {
    return value?.trim().toLocaleLowerCase('hr-HR');
}

export function isKnownNewsFilter(
    values: readonly string[],
    requestedValue: string | undefined,
) {
    const normalizedRequestedValue = normalizeNewsFilterValue(requestedValue);
    return (
        !normalizedRequestedValue ||
        values.some(
            (value) =>
                normalizeNewsFilterValue(value) === normalizedRequestedValue,
        )
    );
}
