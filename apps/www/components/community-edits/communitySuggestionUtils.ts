export function errorMessage(value: unknown) {
    if (
        typeof value === 'object' &&
        value !== null &&
        'message' in value &&
        typeof value.message === 'string'
    ) {
        return value.message;
    }
    if (value instanceof Error) {
        return value.message;
    }
    return 'Slanje prijedloga nije uspjelo.';
}

export function isSubmitResponse(
    value: unknown,
): value is { requestId: number } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'requestId' in value &&
        typeof value.requestId === 'number'
    );
}
