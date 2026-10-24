import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { connect, createServer, type Socket } from 'node:net';
import test, { type TestContext } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import pg from 'pg';
import { activityDelivery } from '../lib/live/activityDelivery';
import type { SystemActivityInput } from '../lib/live/ingestParsers';
import { privateDeliveryId } from '../lib/live/ingestParsers';

async function eventually(check: () => boolean | Promise<boolean>) {
    const deadline = Date.now() + 5_000;
    while (!(await check())) {
        assert.ok(
            Date.now() < deadline,
            'Timed out waiting for database state',
        );
        await setTimeout(20);
    }
}

async function proxyDatabase(t: TestContext, databaseUrl: string) {
    const url = new URL(databaseUrl);
    const sockets = new Set<Socket>();
    const server = createServer((downstream) => {
        const upstream = connect(Number(url.port), url.hostname);
        for (const socket of [downstream, upstream]) {
            sockets.add(socket);
            socket.on('close', () => sockets.delete(socket));
            socket.on('error', () => {
                downstream.destroy();
                upstream.destroy();
            });
        }
        downstream.pipe(upstream).pipe(downstream);
    });
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    const disconnect = () => {
        for (const socket of sockets) socket.destroy();
    };
    t.after(async () => {
        disconnect();
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    return {
        databaseUrl: `postgresql://postgres:status-test@127.0.0.1:${address.port}/postgres`,
        disconnect,
    };
}

test('Status pools recover using the installed pg driver and disposable Postgres', async (t) => {
    // Only a new local container is used; never read database URLs from the env.
    const container = execFileSync(
        'docker',
        [
            'run',
            '--rm',
            '--detach',
            '--publish',
            '127.0.0.1::5432',
            '--env',
            'POSTGRES_PASSWORD=status-test',
            'postgres:16-alpine',
        ],
        { encoding: 'utf8' },
    ).trim();
    const pools: pg.Pool[] = [];
    t.after(async () => {
        try {
            await Promise.all(pools.map((pool) => pool.end()));
        } finally {
            execFileSync('docker', ['rm', '--force', container], {
                stdio: 'ignore',
            });
        }
    });
    const address = execFileSync('docker', ['port', container, '5432/tcp'], {
        encoding: 'utf8',
    }).trim();
    const databaseUrl = `postgresql://postgres:status-test@${address}/postgres`;
    const admin = new pg.Pool({ connectionString: databaseUrl });
    pools.push(admin);
    await eventually(async () => {
        try {
            await admin.query('select 1');
            return true;
        } catch {
            return false;
        }
    });
    await admin.query(
        await readFile(
            new URL(
                '../../../packages/storage/src/migrations/0082_fine_living_tribunal.sql',
                import.meta.url,
            ),
            'utf8',
        ),
    );
    await admin.query(
        'create table events (id integer, type text, created_at timestamptz)',
    );

    const ingestProxy = await proxyDatabase(t, databaseUrl);
    const readProxy = await proxyDatabase(t, databaseUrl);
    // Observe the real pools without replacing acquisition or queries. Local TCP
    // proxies let us reproduce an abrupt EOF as well as PostgreSQL termination.
    class ObservedPool extends pg.Pool {
        constructor(config: pg.PoolConfig) {
            super(config);
            pools.push(this);
        }
    }
    t.mock.module('pg', { defaultExport: { ...pg, Pool: ObservedPool } });
    // Exercise the snapshot without a running Next server or its 30-second cache.
    t.mock.module('next/cache', {
        namedExports: { unstable_cache: (query: unknown) => query },
    });
    const originalEnv = { ...process.env };
    t.after(() => {
        process.env = originalEnv;
    });
    process.env.GREDICE_LIVE_INGEST_DATABASE_URL = `${ingestProxy.databaseUrl}?application_name=status-ingest`;
    process.env.GREDICE_LIVE_DATABASE_URL = `${readProxy.databaseUrl}?application_name=status-read`;
    process.env.GREDICE_LIVE_VERCEL_DRAIN_SECRET = 'test-secret';
    process.env.GREDICE_LIVE_GITHUB_WEBHOOK_SECRET = 'test-secret';
    const logs = t.mock.method(console, 'error', () => undefined);
    t.mock.method(console, 'warn', () => undefined);
    const { storeSystemActivity, storeActivityBatch, pruneSystemActivity } =
        await import('../lib/live/storeSystemActivity');
    const { getLiveActivitySnapshot } = await import(
        '../lib/live/getLiveActivitySnapshot'
    );
    const { POST } = await import('../app/api/live/ingest/[source]/route');
    const occurredAt = new Date();
    occurredAt.setSeconds(0, 0);
    const event: SystemActivityInput = {
        source: 'vercel',
        type: 'vercel.function',
        occurredAt,
        eventCount: 3,
    };
    const eventCount = async () => {
        const result = await admin.query(
            'select event_count from status_live_events',
        );
        return result.rows[0]?.event_count;
    };
    const hasDelivery = async (id: string) => {
        const result = await admin.query(
            'select id from status_live_ingest_deliveries where id = $1',
            [privateDeliveryId('vercel', id)],
        );
        return result.rowCount !== 0;
    };
    assert.equal(
        await storeSystemActivity('vercel', 'initial', [event]),
        'stored',
    );
    assert.equal((await getLiveActivitySnapshot()).source, 'combined-events');
    const [, ingestPool, readPool] = pools;
    assert.ok(ingestPool);
    assert.ok(readPool);
    assert.notEqual(ingestPool, readPool);

    await t.test(
        'both singletons handle idle errors without accumulating listeners',
        async () => {
            for (const pool of [ingestPool, readPool]) {
                assert.equal(pool.listenerCount('error'), 1);
                const client = await pool.connect();
                client.release();
                const before = pool.totalCount;
                const error = Object.assign(
                    new Error('postgresql://private:secret@private.invalid/db'),
                    {
                        code: '57P01',
                        detail: 'private SQL',
                        name: 'private error name',
                    },
                );
                assert.doesNotThrow(() => client.emit('error', error));
                assert.equal(pool.totalCount, before - 1);
                const log = logs.mock.calls.at(-1)?.arguments;
                assert.ok(log);
                assert.doesNotMatch(
                    JSON.stringify(log),
                    /private|secret|password|connectionParameters/,
                );
                assert.ok(JSON.stringify(log).length < 400);
                await pool.query('select 1');
            }
            assert.equal(
                await storeSystemActivity('vercel', 'initial', [event]),
                'duplicate',
            );
            assert.equal(
                (await getLiveActivitySnapshot()).source,
                'combined-events',
            );
            assert.equal(pools.length, 3);
            assert.equal(ingestPool.listenerCount('error'), 1);
            assert.equal(readPool.listenerCount('error'), 1);
        },
    );

    for (const [name, pool] of [
        ['ingest', ingestPool],
        ['read', readPool],
    ] as const) {
        await t.test(
            `${name} removes terminated idle clients and reconnects repeatedly`,
            async () => {
                for (let attempt = 0; attempt < 3; attempt++) {
                    const client = await pool.connect();
                    const result = await client.query<{ pid: number }>(
                        'select pg_backend_pid() as pid',
                    );
                    const pid = result.rows[0]?.pid;
                    assert.ok(pid);
                    client.release();
                    const count = pool.totalCount;
                    const previousLogs = logs.mock.callCount();
                    await admin.query('select pg_terminate_backend($1)', [pid]);
                    await eventually(() => pool.totalCount === count - 1);
                    assert.equal(logs.mock.callCount(), previousLogs + 1);
                    const replacement = await pool.query<{ pid: number }>(
                        'select pg_backend_pid() as pid',
                    );
                    assert.notEqual(replacement.rows[0]?.pid, pid);
                    assert.equal(pool.listenerCount('error'), 1);
                }
                assert.equal(
                    await storeSystemActivity('vercel', 'initial', [event]),
                    'duplicate',
                );
                assert.equal(
                    (await getLiveActivitySnapshot()).source,
                    'combined-events',
                );
                assert.equal(await eventCount(), 3);
            },
        );
    }

    await t.test(
        'both pools recover from the incident error after abrupt TCP disconnects',
        async () => {
            for (const [pool, proxy] of [
                [ingestPool, ingestProxy],
                [readPool, readProxy],
            ] as const) {
                assert.ok(pool.idleCount > 0);
                const connections = pool.totalCount;
                const previousLogs = logs.mock.callCount();
                let disconnectMessage: string | undefined;
                pool.once('error', (error: Error) => {
                    disconnectMessage = error.message;
                });
                proxy.disconnect();
                await eventually(() => pool.totalCount === 0);
                assert.equal(
                    disconnectMessage,
                    'Connection terminated unexpectedly',
                );
                assert.equal(logs.mock.callCount(), previousLogs + connections);
                assert.equal(
                    await storeSystemActivity('vercel', 'initial', [event]),
                    'duplicate',
                );
                assert.equal(
                    (await getLiveActivitySnapshot()).source,
                    'combined-events',
                );
                assert.equal(await eventCount(), 3);
            }
        },
    );

    await t.test(
        'read query failures reject and snapshot source failures remain explicit',
        async () => {
            await assert.rejects(readPool.query('select 1 / 0'), {
                code: '22012',
            });
            const query = readPool.query('select pg_sleep(30)');
            const rejected = assert.rejects(query, { code: '57P01' });
            await eventually(async () => {
                const active =
                    await admin.query(`select pid from pg_stat_activity
                where application_name = 'status-read' and query = 'select pg_sleep(30)'`);
                if (!active.rows[0]) return false;
                await admin.query('select pg_terminate_backend($1)', [
                    active.rows[0].pid,
                ]);
                return true;
            });
            await rejected;
            await admin.query(
                'alter table events rename to unavailable_events',
            );
            try {
                assert.deepEqual(
                    (await getLiveActivitySnapshot()).connectedSources,
                    ['vercel', 'github'],
                );
            } finally {
                await admin.query(
                    'alter table unavailable_events rename to events',
                );
            }
            assert.equal(
                (await getLiveActivitySnapshot()).source,
                'combined-events',
            );
        },
    );

    const interruptWrite = async (operation: () => Promise<void>) => {
        const lock = await admin.connect();
        try {
            await lock.query('begin');
            await lock.query(
                'lock table status_live_events in access exclusive mode',
            );
            const pending = operation();
            await eventually(async () => {
                const blocked =
                    await admin.query(`select pid from pg_stat_activity
                    where application_name = 'status-ingest' and wait_event_type = 'Lock'`);
                if (!blocked.rows[0]) return false;
                await admin.query('select pg_terminate_backend($1)', [
                    blocked.rows[0].pid,
                ]);
                return true;
            });
            await pending;
        } finally {
            await lock.query('rollback');
            lock.release();
        }
    };

    await t.test(
        'transaction disconnect preserves the original error even when rollback fails',
        async () => {
            await interruptWrite(async () => {
                await assert.rejects(
                    storeSystemActivity('vercel', 'interrupted', [event]),
                    { code: '57P01' },
                );
            });
            assert.equal(await hasDelivery('interrupted'), false);
            assert.equal(await eventCount(), 3);
            assert.equal(
                await storeSystemActivity('vercel', 'interrupted', [event]),
                'stored',
            );
            assert.equal(
                await storeSystemActivity('vercel', 'interrupted', [event]),
                'duplicate',
            );
            assert.equal(await eventCount(), 6);
        },
    );

    await t.test(
        'statement and commit failures roll back delivery markers and remain retryable',
        async () => {
            await assert.rejects(
                storeSystemActivity('vercel', 'invalid', [
                    { ...event, eventCount: -100 },
                ]),
                { code: '23514' },
            );
            assert.equal(await hasDelivery('invalid'), false);
            assert.equal(await eventCount(), 6);
            await admin.query(`create function reject_test_commit() returns trigger language plpgsql as $$
            begin raise exception 'test commit failure' using errcode = '40001'; end $$;
            create constraint trigger reject_test_commit after insert on status_live_ingest_deliveries
            deferrable initially deferred for each row execute function reject_test_commit()`);
            try {
                await assert.rejects(
                    storeSystemActivity('vercel', 'commit-failed', [event]),
                    { code: '40001' },
                );
                assert.equal(await hasDelivery('commit-failed'), false);
                assert.equal(await eventCount(), 6);
            } finally {
                await admin.query(
                    'drop trigger reject_test_commit on status_live_ingest_deliveries',
                );
            }
            assert.equal(
                await storeSystemActivity('vercel', 'commit-failed', [event]),
                'stored',
            );
            assert.equal(
                await storeSystemActivity('vercel', 'commit-failed', [event]),
                'duplicate',
            );
            const results = await Promise.all([
                storeSystemActivity('vercel', 'concurrent', [event]),
                storeSystemActivity('vercel', 'concurrent', [event]),
            ]);
            assert.deepEqual(results.sort(), ['duplicate', 'stored']);
            assert.equal(await eventCount(), 12);
        },
    );

    await t.test(
        'signed ingest returns 503 on disconnect then 202 on retry without double counting',
        async () => {
            const body = JSON.stringify([
                { source: 'lambda', timestamp: occurredAt.getTime() },
            ]);
            const signature = createHmac('sha1', 'test-secret')
                .update(body)
                .digest('hex');
            const send = (signatureHeader = signature) =>
                POST(
                    new Request('http://localhost/api/live/ingest/vercel', {
                        method: 'POST',
                        body,
                        headers: { 'x-vercel-signature': signatureHeader },
                    }),
                    { params: Promise.resolve({ source: 'vercel' }) },
                );
            assert.equal((await send('invalid')).status, 401);
            await interruptWrite(async () =>
                assert.equal((await send()).status, 503),
            );
            assert.equal(await hasDelivery(signature), false);
            assert.equal(await eventCount(), 12);
            assert.equal((await send()).status, 202);
            assert.equal((await send()).status, 202);
            assert.equal(await eventCount(), 13);
        },
    );

    await t.test(
        'bulk persistence coalesces only new deliveries and caps integer counts',
        async () => {
            await admin.query(
                'truncate status_live_events, status_live_ingest_deliveries',
            );
            const batch = Array.from({ length: 50 }, (_, index) =>
                activityDelivery('vercel', `batch-${index}`, [event]),
            );
            assert.deepEqual(await storeActivityBatch(batch), {
                deliveries: 50,
                buckets: 1,
            });
            assert.equal(await eventCount(), 150);
            assert.deepEqual(await storeActivityBatch(batch), {
                deliveries: 0,
                buckets: 0,
            });
            assert.equal(await eventCount(), 150);
            const next = activityDelivery('vercel', 'batch-new', [event]);
            assert.deepEqual(await storeActivityBatch([...batch, next, next]), {
                deliveries: 1,
                buckets: 1,
            });
            assert.equal(await eventCount(), 153);
            const saturated = activityDelivery('vercel', 'batch-saturated', [
                { ...event, eventCount: 2147483647 },
            ]);
            await storeActivityBatch([saturated]);
            assert.equal(await eventCount(), 2147483647);
            await storeActivityBatch([
                activityDelivery('vercel', 'batch-overflow', [event]),
            ]);
            assert.equal(await eventCount(), 2147483647);
            const github = {
                ...event,
                source: 'github',
                type: 'github.push',
                eventCount: 1,
            } satisfies SystemActivityInput;
            assert.deepEqual(
                await storeActivityBatch([
                    activityDelivery('github', 'gh-1', [github]),
                    activityDelivery('github', 'gh-2', [github]),
                ]),
                { deliveries: 2, buckets: 1 },
            );
            const ghCount = await admin.query(
                "select event_count from status_live_events where source = 'github'",
            );
            assert.equal(ghCount.rows[0]?.event_count, 2);
        },
    );

    await t.test(
        'retention is bounded and preserves recent delivery replay markers',
        async () => {
            await admin.query(`insert into status_live_ingest_deliveries(id, source, received_at)
            select 'expired-' || n, 'vercel', now() - interval '8 days' from generate_series(1, 10005) as n`);
            await admin.query(`insert into status_live_events(id, source, type, occurred_at)
            select 'expired-' || n, 'vercel', 'vercel.function', now() - interval '25 hours'
            from generate_series(1, 10005) as n`);
            assert.deepEqual(await pruneSystemActivity(), {
                deliveries: 10000,
                events: 10000,
            });
            assert.deepEqual(await pruneSystemActivity(), {
                deliveries: 5,
                events: 5,
            });
            assert.equal(await hasDelivery('batch-new'), true);
            assert.deepEqual(await pruneSystemActivity(), {
                deliveries: 0,
                events: 0,
            });
        },
    );
});
