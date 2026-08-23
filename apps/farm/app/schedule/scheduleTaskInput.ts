export function assertPositiveSafeInteger(
    value: unknown,
    errorMessage: string,
) {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value <= 0
    ) {
        throw new Error(errorMessage);
    }

    return value;
}

export function assertNonNegativeSafeInteger(
    value: unknown,
    errorMessage: string,
) {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0
    ) {
        throw new Error(errorMessage);
    }

    return value;
}
