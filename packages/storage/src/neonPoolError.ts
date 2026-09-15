const transportErrorCodes = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'ENOTFOUND',
    'EAI_AGAIN',
]);

const retryablePostgresConnectionCodes = new Set([
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
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

function isErrorEvent(error: unknown) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        error.type === 'error'
    );
}

function errorChain(error: unknown) {
    const chain: unknown[] = [];
    const pending = [error];
    const seen = new Set<object>();

    while (pending.length > 0 && chain.length < 8) {
        const current = pending.shift();
        chain.push(current);
        if (typeof current !== 'object' || current === null) {
            continue;
        }
        if (seen.has(current)) {
            continue;
        }
        seen.add(current);

        if ('cause' in current) {
            pending.push(current.cause);
        }
        if ('error' in current) {
            pending.push(current.error);
        }
    }

    return chain;
}

export function neonPoolErrorDetails(error: unknown) {
    const chain = errorChain(error);

    // Neon can emit a WebSocket ErrorEvent instead of an Error. Never serialize
    // the event, client, message, stack, or cause: these may contain credentials,
    // endpoint URLs, SQL, or user data (idleListener also adds error.client).
    return {
        kind: chain.some(isErrorEvent)
            ? 'error-event'
            : chain.some((value) => value instanceof Error)
              ? 'error'
              : 'unknown',
        code: chain.map(safeErrorCode).find((code) => code !== undefined),
    };
}

export function isRetryableNeonReadError(error: unknown) {
    return errorChain(error).some((value) => {
        if (isErrorEvent(value)) {
            return true;
        }

        const code = safeErrorCode(value);
        return (
            code !== undefined &&
            (transportErrorCodes.has(code) ||
                code.startsWith('08') ||
                retryablePostgresConnectionCodes.has(code))
        );
    });
}
