import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';
import {
    createActivityBuffer,
    enqueueActivityScript,
} from '../lib/live/activityBuffer';
import { activityDelivery } from '../lib/live/activityDelivery';

test('durable buffer scripts preserve concurrent replay, capacity, age, and worker ownership', async (t) => {
    const container = execFileSync(
        'docker',
        ['run', '--rm', '--detach', 'redis:7-alpine'],
        { encoding: 'utf8' },
    ).trim();
    t.after(() =>
        execFileSync('docker', ['rm', '--force', container], {
            stdio: 'ignore',
        }),
    );
    const redis = (command: (string | number)[]): unknown =>
        JSON.parse(
            execFileSync(
                'docker',
                [
                    'exec',
                    container,
                    'redis-cli',
                    '--json',
                    ...command.map(String),
                ],
                { encoding: 'utf8' },
            ),
        );
    for (let attempt = 0; ; attempt += 1) {
        try {
            assert.equal(redis(['PING']), 'PONG');
            break;
        } catch {
            assert.ok(attempt < 10);
            await setTimeout(100);
        }
    }
    const buffer = createActivityBuffer(
        { url: 'https://local-buffer.invalid', token: 'test', prefix: 'test' },
        async (_input, init) => {
            assert.equal(typeof init?.body, 'string');
            const command: unknown = JSON.parse(String(init?.body));
            assert.ok(Array.isArray(command));
            assert.ok(
                command.every(
                    (argument) =>
                        typeof argument === 'string' ||
                        typeof argument === 'number',
                ),
            );
            return Response.json({ result: redis(command) });
        },
    );
    const event = {
        source: 'vercel',
        type: 'vercel.function',
        occurredAt: new Date(),
        eventCount: 1,
    } satisfies Parameters<typeof activityDelivery>[2][number];
    const first = activityDelivery('vercel', 'delivery', [event]);
    assert.deepEqual(
        (
            await Promise.all([buffer.enqueue(first), buffer.enqueue(first)])
        ).sort(),
        ['buffered', 'duplicate'],
    );
    assert.equal(redis(['HLEN', 'test:pending']), 1);
    assert.equal(redis(['TTL', 'test:pending']), -1);
    const batch = await buffer.read('worker-1');
    assert.equal(batch.status, 'ready');
    assert.deepEqual(batch.deliveries, [first]);
    assert.equal((await buffer.read('worker-2')).status, 'busy');
    await assert.rejects(buffer.acknowledge('worker-2', [first.id]));
    assert.equal(redis(['HLEN', 'test:pending']), 1);
    await buffer.release('worker-2');
    assert.equal(redis(['GET', 'test:flush']), 'worker-1');
    await buffer.release('worker-1');
    assert.equal((await buffer.read('worker-2')).status, 'ready');
    await buffer.acknowledge('worker-2', [first.id]);
    assert.equal((await buffer.read('worker-2')).status, 'empty');
    assert.equal(redis(['HLEN', 'test:pending']), 0);
    assert.equal(redis(['ZCARD', 'test:order']), 0);

    const enqueueWithLimits = (
        id: string,
        receivedAt: number,
        maxSize: number,
        maxAge: number,
    ) =>
        redis([
            'EVAL',
            enqueueActivityScript,
            2,
            'bounded:pending',
            'bounded:order',
            id,
            '{}',
            receivedAt,
            maxSize,
            maxAge,
        ]);
    assert.equal(enqueueWithLimits('one', 1000, 2, 100), 'buffered');
    assert.equal(enqueueWithLimits('two', 1099, 2, 100), 'buffered');
    assert.equal(enqueueWithLimits('three', 1099, 2, 100), 'full');
    assert.equal(enqueueWithLimits('one', 9999, 2, 100), 'duplicate');
    assert.equal(enqueueWithLimits('three', 1100, 3, 100), 'stale');
    assert.equal(redis(['HLEN', 'bounded:pending']), 2);
    assert.equal(redis(['ZCARD', 'bounded:order']), 2);
    // A crashed worker leaves immutable work, and lease expiry allows recovery.
    const queued = activityDelivery('vercel', 'after-crash', [event]);
    await buffer.enqueue(queued);
    await buffer.read('crashed');
    redis(['DEL', 'test:flush']);
    assert.deepEqual((await buffer.read('replacement')).deliveries, [queued]);
});
