import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';
import {
    createActivityBuffer,
    enqueueActivityScript,
} from '../lib/live/activityBuffer';
import {
    activityDelivery,
    activityDeliveryChunks,
} from '../lib/live/activityDelivery';

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

test('admission cursors let large retries progress after a flushed prefix under bounded capacity', async (t) => {
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
    for (let attempt = 0; ; attempt++) {
        try {
            assert.equal(redis(['PING']), 'PONG');
            break;
        } catch {
            assert.ok(attempt < 10);
            await setTimeout(100);
        }
    }
    const buffer = createActivityBuffer(
        { url: 'https://buffer.invalid', token: 'test', prefix: 'cursor' },
        async (_input, init) => {
            const command = JSON.parse(String(init?.body));
            return Response.json({ result: redis(command) });
        },
    );
    const events: Parameters<typeof activityDelivery>[2] = Array.from(
        { length: 500 },
        (_, i) => ({
            source: 'vercel',
            type: 'vercel.function',
            occurredAt: new Date(Date.UTC(2026, 9, 2, 0, i)),
            eventCount: 1,
        }),
    );
    const chunks = activityDeliveryChunks('vercel', 'large-race', events);
    assert.equal(chunks.length, 5);
    // Other admitted work occupies all but two slots; it has no order entry in this fixture.
    redis([
        'EVAL',
        "for i=1,2046 do redis.call('HSET',KEYS[1], 'fixture-'..i, '{}') end return 1",
        1,
        'cursor:pending',
    ]);
    const persisted = new Map<string, (typeof chunks)[number]>();
    let attempts = 0;
    for (; attempts < 3; attempts++) {
        let blocked = false;
        for (const chunk of chunks) {
            if ((await buffer.enqueue(chunk)) === 'full') {
                blocked = true;
                break;
            }
        }
        const batch = await buffer.read('worker');
        for (const delivery of batch.deliveries)
            persisted.set(delivery.id, delivery);
        await buffer.acknowledge(
            'worker',
            batch.deliveries.map((delivery) => delivery.id),
        );
        await buffer.release('worker');
        if (!blocked) break;
    }
    assert.equal(attempts, 2);
    assert.equal(persisted.size, 5);
    assert.equal(
        Array.from(persisted.values()).flatMap((delivery) => delivery.events)
            .length,
        500,
    );
    const parentId = chunks[0]?.admission?.parentId;
    assert.ok(parentId);
    assert.equal(redis(['GET', `cursor:admission:${parentId}`]), '4');
    assert.ok(Number(redis(['TTL', `cursor:admission:${parentId}`])) > 0);
    assert.equal(await buffer.enqueue(chunks[0]), 'duplicate');
    assert.equal(redis(['HLEN', 'cursor:pending']), 2046);
});
