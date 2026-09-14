import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveActivityPool } from './createLiveActivityPool';

test('both roles install bounded, sanitized diagnostics before connecting', async (t) => {
    const logs = t.mock.method(console, 'error', () => undefined);
    const secret = 'postgresql://private:secret@database.invalid/private';
    for (const role of ['read', 'ingest'] as const) {
        const pool = createLiveActivityPool(`${secret}?sslmode=require`, role);
        t.after(() => pool.end());
        assert.equal(pool.totalCount, 0);
        assert.equal(pool.listenerCount('error'), 1);
        assert.equal(pool.options.max, 2);
        assert.equal(pool.options.idleTimeoutMillis, 10_000);
        assert.equal(pool.options.connectionTimeoutMillis, 5_000);
        assert.equal(
            new URL(pool.options.connectionString ?? '').searchParams.get(
                'sslmode',
            ),
            'verify-full',
        );

        for (const code of [
            '57P01',
            '08006',
            'ECONNRESET',
            'ETIMEDOUT',
            undefined,
            secret,
            secret.repeat(1000),
            129,
        ]) {
            const error = Object.assign(new Error(secret), {
                code,
                name: secret,
                detail: secret,
                client: { connectionParameters: { password: secret } },
                cause: new Error(secret),
            });
            const previousLogs = logs.mock.callCount();
            assert.doesNotThrow(() => pool.emit('error', error));
            assert.equal(logs.mock.callCount(), previousLogs + 1);
            const log = logs.mock.calls.at(-1)?.arguments;
            assert.deepEqual(log, [
                'Status live pool background connection error',
                {
                    event: 'status.live.pool.error',
                    pool: role,
                    error: {
                        kind: 'error',
                        code:
                            typeof code === 'string' && !code.includes(secret)
                                ? code
                                : undefined,
                    },
                    totalCount: 0,
                    idleCount: 0,
                    waitingCount: 0,
                },
            ]);
            assert.doesNotMatch(
                JSON.stringify(log),
                /secret|database\.invalid|password|connectionParameters/,
            );
            assert.ok(JSON.stringify(log).length < 400);
        }
        for (const value of [null, undefined, secret, {}, { code: secret }]) {
            assert.doesNotThrow(() => pool.emit('error', value));
            assert.doesNotMatch(
                JSON.stringify(logs.mock.calls.at(-1)?.arguments),
                /secret|database\.invalid/,
            );
        }
        assert.equal(pool.listenerCount('error'), 1);
        assert.equal(pool.totalCount, 0);
    }
});

test('pool normalization preserves explicit TLS modes and separate credentials', async (t) => {
    const read = createLiveActivityPool(
        'postgresql://reader:read@localhost/test?sslmode=disable',
        'read',
    );
    const ingest = createLiveActivityPool(
        'postgresql://writer:write@localhost/test?sslmode=verify-full',
        'ingest',
    );
    t.after(() => Promise.all([read.end(), ingest.end()]));
    assert.notEqual(read, ingest);
    assert.equal(
        read.options.connectionString,
        'postgresql://reader:read@localhost/test?sslmode=disable',
    );
    assert.equal(
        ingest.options.connectionString,
        'postgresql://writer:write@localhost/test?sslmode=verify-full',
    );
});
