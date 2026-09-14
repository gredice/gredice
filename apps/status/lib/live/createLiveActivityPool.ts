import 'server-only';

import pg from 'pg';

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
    return typeof code === 'string' &&
        (/^[0-9A-Z]{5}$/.test(code) || transportErrorCodes.has(code))
        ? code
        : undefined;
}

export function createLiveActivityPool(
    connectionString: string,
    role: 'read' | 'ingest',
) {
    const url = new URL(connectionString);
    if (url.searchParams.get('sslmode') === 'require') {
        url.searchParams.set('sslmode', 'verify-full');
    }

    const pool = new pg.Pool({
        connectionString: url.toString(),
        max: 2,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 5_000,
    });
    // pg removes the failed idle client before emitting this event. Register
    // before first use; leave removal, reconnection, and query failures to pg.
    pool.on('error', (error: unknown) => {
        // Fixed-size metadata only: pg attaches the client (and credentials) to
        // the error. Never serialize it, its name/message/stack, or the client.
        console.error('Status live pool background connection error', {
            event: 'status.live.pool.error',
            pool: role,
            error: {
                kind: error instanceof Error ? 'error' : 'unknown',
                code: safeErrorCode(error),
            },
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
        });
    });
    return pool;
}
