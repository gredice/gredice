import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import {
    acknowledgeDueWork,
    readDueWorkSignal,
    signalDueWork,
    withDueWorkCommitSignals,
} from '../src/dueWork';
import { storage } from '../src/storage';

const execute = promisify(execFile);

test('after-commit scopes coalesce earliest due time and discard nested rollbacks', async () => {
    const published: Array<[string, number]> = [];
    const publish = async (job: string, dueAt: number) => {
        published.push([job, dueAt]);
    };
    const result = await withDueWorkCommitSignals(async () => {
        await signalDueWork('automations', new Date(200));
        await withDueWorkCommitSignals(async () => {
            await signalDueWork('automations', new Date(100));
            await signalDueWork('checkout-notifications', new Date(300));
        }, publish);
        assert.deepEqual(published, []);
        await assert.rejects(
            withDueWorkCommitSignals(async () => {
                await signalDueWork('order-confirmation-emails', new Date(1));
                throw new Error('savepoint rollback');
            }, publish),
        );
        return 'committed';
    }, publish);
    assert.equal(result, 'committed');
    assert.deepEqual(published, [
        ['automations', 100],
        ['checkout-notifications', 300],
    ]);
});

test('outer rollback discards successful nested scopes and retry publishes once', async () => {
    const published: string[] = [];
    const publish = async (job: string) => {
        published.push(job);
    };
    await assert.rejects(
        withDueWorkCommitSignals(async () => {
            await withDueWorkCommitSignals(async () => {
                await signalDueWork('automations');
            }, publish);
            throw new Error('serialization rollback');
        }, publish),
    );
    assert.deepEqual(published, []);
    await withDueWorkCommitSignals(async () => {
        await signalDueWork('automations');
    }, publish);
    assert.deepEqual(published, ['automations']);
});

test('a hint failure never changes a successful committed response', async () => {
    const previousWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args) => {
        warnings.push(args);
    };
    try {
        assert.equal(
            await withDueWorkCommitSignals(
                async () => {
                    await signalDueWork('automations');
                    return 'committed';
                },
                async () => {
                    throw new Error('Redis unavailable');
                },
            ),
            'committed',
        );
        assert.equal(warnings.length, 1);
    } finally {
        console.warn = previousWarn;
    }
});

const dockerRedisAvailable =
    process.env.GREDICE_TEST_DB_PROVIDER !== 'pglite' &&
    spawnSync('docker', ['image', 'inspect', 'redis:7-alpine'], {
        stdio: 'ignore',
    }).status === 0;

test('real Redis CAS keeps raced enqueues and real database transactions publish after commit', {
    skip: !dockerRedisAvailable && 'local Redis Docker image unavailable',
}, async () => {
    const name = `gredice-due-work-test-${randomUUID()}`;
    await execute('docker', [
        'run',
        '-d',
        '--rm',
        '--name',
        name,
        'redis:7-alpine',
    ]);
    for (let attempt = 0; attempt < 30; attempt++) {
        try {
            const { stdout } = await execute('docker', [
                'exec',
                name,
                'redis-cli',
                'ping',
            ]);
            if (stdout.trim() === 'PONG') break;
        } catch {
            if (attempt === 29)
                throw new Error('Disposable Redis did not start');
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
    const commands: unknown[] = [];
    const server = createServer(async (request, response) => {
        try {
            const buffers: Buffer[] = [];
            for await (const chunk of request) buffers.push(Buffer.from(chunk));
            const command: unknown = JSON.parse(
                Buffer.concat(buffers).toString(),
            );
            assert.ok(Array.isArray(command));
            assert.ok(
                command.every(
                    (part) =>
                        typeof part === 'string' || typeof part === 'number',
                ),
            );
            commands.push(command);
            const { stdout } = await execute('docker', [
                'exec',
                name,
                'redis-cli',
                '--json',
                ...command.map(String),
            ]);
            response.setHeader('content-type', 'application/json');
            const result: unknown = JSON.parse(stdout);
            response.end(
                JSON.stringify({
                    result:
                        command[0] === 'hgetall' &&
                        typeof result === 'object' &&
                        result !== null &&
                        !Array.isArray(result)
                            ? Object.entries(result).flat()
                            : result,
                }),
            );
        } catch {
            response.writeHead(500).end();
        }
    });
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const previousUrl = process.env.GREDICE_SILO_KV_REST_API_URL;
    const previousToken = process.env.GREDICE_SILO_KV_REST_API_TOKEN;
    const previousSha = process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.GREDICE_SILO_KV_REST_API_URL = `http://127.0.0.1:${address.port}`;
    process.env.GREDICE_SILO_KV_REST_API_TOKEN = 'disposable-test-only';
    process.env.VERCEL_GIT_COMMIT_SHA = randomUUID();
    try {
        const now = new Date();
        const original = await readDueWorkSignal('automations');
        assert.ok(original);
        assert.equal(original.generation, 0);
        await Promise.all(
            Array.from({ length: 10 }, (_, index) =>
                signalDueWork('automations', new Date(now.getTime() + index)),
            ),
        );
        const first = await readDueWorkSignal('automations');
        assert.ok(first);
        assert.equal(first.generation, 10);
        assert.equal(first.dueAt, now.getTime());
        await signalDueWork('automations', now);
        assert.equal(
            await acknowledgeDueWork(
                'automations',
                first.generation,
                null,
                now,
            ),
            false,
        );
        const raced = await readDueWorkSignal('automations');
        assert.ok(raced);
        assert.equal(raced.dueAt, now.getTime());
        const retryAt = new Date(now.getTime() + 60_000);
        assert.equal(
            await acknowledgeDueWork(
                'automations',
                raced.generation,
                retryAt,
                now,
            ),
            true,
        );
        assert.equal(
            (await readDueWorkSignal('automations'))?.dueAt,
            retryAt.getTime(),
        );
        assert.equal(
            await acknowledgeDueWork(
                'automations',
                raced.generation,
                null,
                now,
            ),
            true,
        );
        assert.equal((await readDueWorkSignal('automations'))?.dueAt, null);

        commands.length = 0;
        await storage().transaction(async (tx) => {
            await tx.execute(sql`select 1`);
            await tx.transaction(async (nested) => {
                await nested.execute(sql`select 2`);
                await signalDueWork('checkout-notifications', now);
            });
            assert.equal(commands.length, 0);
            await assert.rejects(
                tx.transaction(async () => {
                    await signalDueWork('order-confirmation-emails', now);
                    throw new Error('nested rollback');
                }),
            );
            assert.equal(commands.length, 0);
        });
        assert.equal(commands.length, 1);
        assert.equal(
            (await readDueWorkSignal('checkout-notifications'))?.generation,
            1,
        );
        assert.equal(
            (await readDueWorkSignal('order-confirmation-emails'))?.generation,
            0,
        );
        commands.length = 0;
        await assert.rejects(
            storage().transaction(async (tx) => {
                await tx.transaction(async () => {
                    await signalDueWork('checkout-notifications', now);
                });
                throw new Error('outer rollback');
            }),
        );
        assert.equal(commands.length, 0);
    } finally {
        if (previousUrl === undefined)
            delete process.env.GREDICE_SILO_KV_REST_API_URL;
        else process.env.GREDICE_SILO_KV_REST_API_URL = previousUrl;
        if (previousToken === undefined)
            delete process.env.GREDICE_SILO_KV_REST_API_TOKEN;
        else process.env.GREDICE_SILO_KV_REST_API_TOKEN = previousToken;
        if (previousSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
        else process.env.VERCEL_GIT_COMMIT_SHA = previousSha;
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await execute('docker', ['rm', '-f', name]);
    }
});
