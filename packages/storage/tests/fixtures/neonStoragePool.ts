import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { closeStorage, storage } from '../../src/storage';

test('production pool lifecycle using the installed Neon driver', async (t) => {
    // Stub only the transport. Pool acquisition, release, idleListener, query
    // error forwarding, and Drizzle transactions use their real implementations.
    let connectionError: Error | undefined;
    let queryError: Error | undefined;
    let activeConnectionError: Error | undefined;
    const statements: string[] = [];
    t.mock.method(Client.prototype, 'connect', (...args: unknown[]) => {
        const callback = args.at(-1);
        assert.equal(typeof callback, 'function');
        if (typeof callback === 'function') {
            queueMicrotask(() => callback(connectionError));
        }
    });
    const end = t.mock.method(Client.prototype, 'end', () => Promise.resolve());
    t.mock.method(
        Client.prototype,
        'query',
        function (this: Client, ...args: unknown[]) {
            const query = args[0];
            const text =
                typeof query === 'string'
                    ? query
                    : typeof query === 'object' &&
                        query !== null &&
                        'text' in query
                      ? query.text
                      : undefined;
            assert.equal(typeof text, 'string');
            if (typeof text === 'string') statements.push(text.trim());
            const callback = args.at(-1);
            const result = {
                rows: [],
                fields: [],
                rowCount: 0,
                command: 'SELECT',
            };
            const error = text === 'select fail' ? queryError : undefined;
            if (typeof callback === 'function') {
                queueMicrotask(() => {
                    if (activeConnectionError) {
                        this.emit('error', activeConnectionError);
                    } else {
                        callback(error, result);
                    }
                });
                return;
            }
            return error ? Promise.reject(error) : Promise.resolve(result);
        },
    );
    const logs = t.mock.method(console, 'error', () => undefined);
    t.after(closeStorage);

    const db = storage();
    assert.ok('$client' in db && db.$client instanceof Pool);
    const pool = db.$client;

    await t.test('singleton has one error listener before use', async () => {
        assert.equal(pool.listenerCount('error'), 1);
        assert.equal(storage(), db);
        assert.equal(storage(), db);
        assert.equal(pool.listenerCount('error'), 1);
        assert.equal(pool.totalCount, 0);
        await db.execute(sql`select 1`);
    });

    await t.test(
        'real idleListener removes failed clients, logs safely, and allows reuse',
        async () => {
            for (const error of [
                Object.assign(
                    new Error('postgresql://test:secret@database.invalid/test'),
                    { code: '57P01', detail: 'private SQL and user data' },
                ),
                {
                    type: 'error',
                    target: { url: 'wss://secret@database.invalid' },
                    error: Object.assign(new Error('secret'), {
                        code: 'ECONNRESET',
                    }),
                },
                {},
            ]) {
                const client = await pool.connect();
                client.release();
                assert.equal(pool.idleCount, 1);
                const previousLogs = logs.mock.callCount();
                const previousEnds = end.mock.callCount();
                assert.doesNotThrow(() => client.emit('error', error));
                assert.equal(pool.totalCount, 0);
                assert.equal(pool.idleCount, 0);
                assert.equal(end.mock.callCount(), previousEnds + 1);
                assert.equal(logs.mock.callCount(), previousLogs + 1);
                const log = logs.mock.calls.at(-1)?.arguments;
                assert.deepEqual(log, [
                    'Neon pool background connection error',
                    {
                        event: 'storage.neon.pool.error',
                        error: {
                            kind:
                                error instanceof Error
                                    ? 'error'
                                    : 'type' in error
                                      ? 'error-event'
                                      : 'unknown',
                            code:
                                'code' in error
                                    ? '57P01'
                                    : 'type' in error
                                      ? 'ECONNRESET'
                                      : undefined,
                        },
                        totalCount: 0,
                        idleCount: 0,
                        waitingCount: 0,
                    },
                ]);
                assert.doesNotMatch(
                    JSON.stringify(log),
                    /secret|database\.invalid|private SQL/,
                );
                await db.execute(sql`select 1`);
                assert.equal(storage(), db);
            }
        },
    );

    await t.test(
        'active query connection failures reject with the original error',
        async () => {
            activeConnectionError = new Error('active connection failed');
            const previousLogs = logs.mock.callCount();
            await assert.rejects(
                pool.query('select 1'),
                (error) => error === activeConnectionError,
            );
            assert.equal(logs.mock.callCount(), previousLogs);
            activeConnectionError = undefined;
        },
    );

    await t.test(
        'query errors retain their cause and transactions roll back',
        async () => {
            queryError = Object.assign(new Error('constraint violation'), {
                code: '23505',
            });
            const previousLogs = logs.mock.callCount();
            await assert.rejects(
                pool.query('select fail'),
                (error) => error === queryError,
            );
            const start = statements.length;
            await assert.rejects(
                db.transaction(async (tx) => {
                    await tx.execute(sql.raw('select fail'));
                }),
                (error) => error instanceof Error && error.cause === queryError,
            );
            assert.deepEqual(statements.slice(start), [
                'begin',
                'select fail',
                'rollback',
            ]);
            assert.equal(logs.mock.callCount(), previousLogs);
            queryError = undefined;
            const successStart = statements.length;
            await db.transaction(async (tx) => {
                await tx.execute(sql`select 1`);
            });
            assert.deepEqual(statements.slice(successStart), [
                'begin',
                'select 1',
                'commit',
            ]);
        },
    );

    await t.test(
        'close and recreate installs one listener on the new pool',
        async () => {
            await closeStorage();
            assert.equal(pool.ended, true);
            const newDb = storage();
            assert.notEqual(newDb, db);
            assert.ok('$client' in newDb && newDb.$client instanceof Pool);
            const newPool = newDb.$client;
            assert.notEqual(newPool, pool);
            assert.equal(newPool.listenerCount('error'), 1);
            const previousLogs = logs.mock.callCount();
            assert.doesNotThrow(() => newPool.emit('error', {}));
            assert.equal(logs.mock.callCount(), previousLogs + 1);
        },
    );

    await t.test('connection acquisition failures still reject', async () => {
        const newDb = storage();
        assert.ok('$client' in newDb && newDb.$client instanceof Pool);
        connectionError = new Error('connection refused');
        const previousLogs = logs.mock.callCount();
        await assert.rejects(
            newDb.$client.connect(),
            (error) => error === connectionError,
        );
        assert.equal(logs.mock.callCount(), previousLogs);
        connectionError = undefined;
    });
});
