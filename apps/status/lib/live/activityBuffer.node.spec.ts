import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptSystemActivity } from './acceptSystemActivity';
import {
    type ActivityBuffer,
    activityBufferPrefix,
    createActivityBuffer,
} from './activityBuffer';
import {
    type ActivityDelivery,
    activityDelivery,
    decodeActivityDelivery,
    MAX_DELIVERY_BYTES,
} from './activityDelivery';
import { flushSystemActivity } from './flushSystemActivity';
import { storeActivityBatch } from './storeSystemActivity';

const event = {
    source: 'vercel',
    type: 'vercel.function',
    occurredAt: new Date('2026-10-02T08:10:05.000Z'),
    eventCount: 3,
} satisfies Parameters<typeof activityDelivery>[2][number];

test('delivery identity coalesces minute pulses and omits raw identifiers', () => {
    const a = activityDelivery('vercel', 'private-delivery', [event]);
    const b = activityDelivery('vercel', 'another-delivery', [
        { ...event, occurredAt: new Date('2026-10-02T08:10:59.000Z') },
    ]);
    assert.notEqual(a.id, b.id);
    assert.equal(a.events[0]?.id, b.events[0]?.id);
    assert.equal(a.events[0]?.occurredAt, '2026-10-02T08:10:00.000Z');
    assert.doesNotMatch(JSON.stringify(a), /private-delivery/);
    assert.deepEqual(decodeActivityDelivery(JSON.stringify(a)), a);
    for (const invalid of [
        { ...a, source: 'private-source' },
        { ...a, receivedAt: 'invalid' },
        { ...a, id: 'raw-delivery' },
        { ...a, events: [{ ...a.events[0], eventCount: 0 }] },
        { ...a, events: [{ ...a.events[0], eventCount: 1.5 }] },
        { ...a, events: [{ ...a.events[0], type: 'vercel.private-route' }] },
        { ...a, events: [{ ...a.events[0], source: 'github' }] },
    ])
        assert.throws(() => decodeActivityDelivery(JSON.stringify(invalid)));
    assert.throws(() =>
        decodeActivityDelivery(' '.repeat(MAX_DELIVERY_BYTES + 1)),
    );
});

test('buffer isolates production and preview deployment keys', () => {
    assert.equal(
        activityBufferPrefix({ VERCEL_ENV: 'production' }),
        'status-live:production:v1',
    );
    assert.equal(
        activityBufferPrefix({
            VERCEL_ENV: 'preview',
            VERCEL_URL: 'preview.invalid',
        }),
        'status-live:preview:preview.invalid:v1',
    );
    assert.equal(
        activityBufferPrefix({
            GREDICE_LIVE_BUFFER_PREFIX: 'separate',
            VERCEL_ENV: 'production',
        }),
        'separate:production:v1',
    );
});

test('missing or invalid buffer configuration fails closed before any Postgres connection', async (t) => {
    const previous = { ...process.env };
    t.after(() => {
        process.env = previous;
    });
    process.env.GREDICE_LIVE_INGEST_DATABASE_URL =
        'postgres://private:secret@database.invalid/db';
    delete process.env.GREDICE_LIVE_BUFFER_REST_API_URL;
    delete process.env.GREDICE_LIVE_BUFFER_REST_API_TOKEN;
    process.env.GREDICE_LIVE_INGEST_MODE = 'buffered';
    process.env.CRON_SECRET = 'test-cron';
    assert.equal(
        await acceptSystemActivity('vercel', 'delivery', [event]),
        'unavailable',
    );
    process.env.GREDICE_LIVE_INGEST_MODE = 'invalid';
    assert.equal(
        await acceptSystemActivity('vercel', 'delivery', [event]),
        'unavailable',
    );
});

test('REST transport requires durable admission and rejects provider errors', async () => {
    const credentials = {
        url: 'https://buffer.invalid',
        token: 'private-token',
        prefix: 'test',
    };
    const delivery = activityDelivery('vercel', 'delivery', [event]);
    for (const result of ['buffered', 'duplicate', 'full', 'stale']) {
        const buffer = createActivityBuffer(
            credentials,
            async (_input, init) => {
                assert.equal(init?.cache, 'no-store');
                assert.ok(init?.signal);
                assert.equal(init?.method, 'POST');
                return Response.json({ result });
            },
        );
        assert.equal(await buffer.enqueue(delivery), result);
    }
    for (const response of [
        Response.json({ error: 'provider details' }),
        Response.json({ result: 'invalid' }),
        new Response('failed', { status: 503 }),
    ]) {
        const buffer = createActivityBuffer(credentials, async () => response);
        await assert.rejects(buffer.enqueue(delivery));
    }
    assert.throws(() =>
        createActivityBuffer({ ...credentials, url: 'http://buffer.invalid' }),
    );
});

function memoryBuffer(delivery?: ActivityDelivery): ActivityBuffer {
    let pending = delivery ? [delivery] : [];
    return {
        async enqueue() {
            return 'buffered';
        },
        async read() {
            return {
                status: pending.length ? 'ready' : 'empty',
                deliveries: pending,
            };
        },
        async acknowledge() {
            pending = [];
        },
        async release() {},
    };
}

test('empty flush and empty persistence never access Postgres', async () => {
    let persistenceCalls = 0;
    const result = await flushSystemActivity(memoryBuffer(), async () => {
        persistenceCalls += 1;
        throw new Error('Unexpected persistence');
    });
    assert.equal(result.status, 'empty');
    assert.equal(persistenceCalls, 0);
    assert.deepEqual(await storeActivityBatch([]), {
        deliveries: 0,
        buckets: 0,
    });
});

test('failed persistence leaves deliveries queued for a safe retry', async () => {
    const buffer = memoryBuffer(
        activityDelivery('vercel', 'delivery', [event]),
    );
    const failure = new Error('Database interrupted');
    await assert.rejects(
        flushSystemActivity(buffer, async () => {
            throw failure;
        }),
        failure,
    );
    assert.equal((await buffer.read('test')).deliveries.length, 1);
    const retried = await flushSystemActivity(buffer, async () => ({
        deliveries: 1,
        buckets: 1,
    }));
    assert.equal(retried.deliveries, 1);
    assert.equal((await buffer.read('test')).status, 'empty');
});

test('failed ACK after commit retries persistence and records duplicate counts', async () => {
    const base = memoryBuffer(activityDelivery('vercel', 'delivery', [event]));
    let committed = false;
    let rejectAck = true;
    const buffer = {
        ...base,
        async acknowledge() {
            if (rejectAck) throw new Error('Redis interrupted');
            await base.acknowledge('test', []);
        },
    };
    const persist = async () => {
        const counts = committed
            ? { deliveries: 0, buckets: 0 }
            : { deliveries: 1, buckets: 1 };
        committed = true;
        return counts;
    };
    await assert.rejects(flushSystemActivity(buffer, persist));
    assert.equal((await base.read('test')).deliveries.length, 1);
    rejectAck = false;
    const result = await flushSystemActivity(buffer, persist);
    assert.equal(result.deliveries, 0);
    assert.equal(result.duplicates, 1);
});

test('flush bounds work and releases its lease even after interruption', async () => {
    const delivery = activityDelivery('vercel', 'delivery', [event]);
    let calls = 0;
    let released = false;
    const buffer = {
        ...memoryBuffer(delivery),
        async acknowledge() {
            calls += 1;
        },
        async release() {
            released = true;
        },
    };
    const result = await flushSystemActivity(buffer, async () => ({
        deliveries: 1,
        buckets: 1,
    }));
    assert.equal(result.status, 'bounded');
    assert.equal(calls, 10);
    assert.equal(released, true);
});
