const boundedDiagnosticToken = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

function boundedToken(value: unknown) {
    return typeof value === 'string' && boundedDiagnosticToken.test(value)
        ? value
        : undefined;
}

/**
 * Keeps operational failure logs useful without emitting messages, stacks,
 * webhook payloads, credentials, or connection details.
 */
export function getStripeOperationalErrorDiagnostic(error: unknown) {
    const errorName = boundedToken(error instanceof Error ? error.name : null);
    const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
            ? boundedToken(error.code)
            : undefined;

    return {
        errorCode,
        errorName: errorName ?? 'Unknown',
    };
}
