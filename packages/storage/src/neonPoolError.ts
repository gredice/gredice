const transportErrorCodes = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'ENOTFOUND',
    'EAI_AGAIN',
]);

function safeErrorCode(error: unknown) {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return undefined;
    }
    const code = error.code;
    // PostgreSQL SQLSTATEs and known transport codes contain no free-form data.
    return typeof code === 'string' &&
        (/^[0-9A-Z]{5}$/.test(code) || transportErrorCodes.has(code))
        ? code
        : undefined;
}

export function neonPoolErrorDetails(error: unknown) {
    const isObject = typeof error === 'object' && error !== null;
    const isErrorEvent = isObject && 'type' in error && error.type === 'error';
    const nestedError = isObject && 'error' in error ? error.error : undefined;
    const cause = isObject && 'cause' in error ? error.cause : undefined;

    // Neon can emit a WebSocket ErrorEvent instead of an Error. Never serialize
    // the event, client, message, stack, or cause: these may contain credentials,
    // endpoint URLs, SQL, or user data (idleListener also adds error.client).
    return {
        kind:
            error instanceof Error
                ? 'error'
                : isErrorEvent
                  ? 'error-event'
                  : 'unknown',
        code:
            safeErrorCode(error) ??
            safeErrorCode(nestedError) ??
            safeErrorCode(cause),
    };
}
