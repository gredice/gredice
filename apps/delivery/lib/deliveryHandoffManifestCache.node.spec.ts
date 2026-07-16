import assert from 'node:assert/strict';
import test from 'node:test';
import type { DeliveryHandoffManifest } from './deliveryHandoffManifest';
import {
    createDeliveryHandoffManifestCacheRecord,
    createMemoryDeliveryHandoffManifestCachePersistence,
    createWebStorageDeliveryHandoffManifestCachePersistence,
    type DeliveryHandoffManifestWebStorage,
    deliveryHandoffManifestCacheTtlMs,
} from './deliveryHandoffManifestCache';

class MemoryWebStorage implements DeliveryHandoffManifestWebStorage {
    readonly values = new Map<string, string>();
    failReads = false;
    failRemoval = false;

    get length() {
        return this.values.size;
    }

    key(index: number) {
        return Array.from(this.values.keys())[index] ?? null;
    }

    getItem(key: string) {
        if (this.failReads) throw new Error('storage unavailable');
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.values.set(key, value);
    }

    removeItem(key: string) {
        if (this.failRemoval) throw new Error('storage unavailable');
        this.values.delete(key);
    }
}

function manifest({
    runId = 'run-1',
    targetStopId = 101,
    retryAttempt = 0,
}: {
    runId?: string;
    targetStopId?: number;
    retryAttempt?: number;
} = {}): DeliveryHandoffManifest {
    return {
        runId,
        targetStopId,
        version: 1,
        retryAttempt,
        items: [
            {
                stopId: targetStopId,
                deliveryRequestId: `request-${targetStopId}`,
                retryAttempt,
                traceLinkId: 500 + targetStopId,
                qrAvailable: true,
                state: 'unverified',
                reason: null,
                verifiedAt: null,
            },
        ],
        expectedCount: 1,
        scannedCount: 0,
        unverifiedCount: 1,
        noLabelCount: 0,
        missingCount: 0,
        skippedCount: 0,
    };
}

const now = new Date('2026-07-16T08:00:00.000Z');

test('cache identity includes user, run, physical target, and retry attempt', async () => {
    const persistence = createMemoryDeliveryHandoffManifestCachePersistence();
    const records = [
        createDeliveryHandoffManifestCacheRecord({
            userId: 'driver-1',
            manifest: manifest(),
            now,
        }),
        createDeliveryHandoffManifestCacheRecord({
            userId: 'driver-1',
            manifest: manifest({ retryAttempt: 1 }),
            now,
        }),
        createDeliveryHandoffManifestCacheRecord({
            userId: 'driver-1',
            manifest: manifest({ targetStopId: 102 }),
            now,
        }),
        createDeliveryHandoffManifestCacheRecord({
            userId: 'driver-2',
            manifest: manifest(),
            now,
        }),
        createDeliveryHandoffManifestCacheRecord({
            userId: 'driver-1',
            manifest: manifest({ retryAttempt: 10 }),
            now,
        }),
    ];
    for (const record of records) await persistence.save(record);
    const [first, second, third, fourth, tenthAttempt] = records;
    if (!first || !second || !third || !fourth || !tenthAttempt) {
        throw new Error('Expected five isolated cache records');
    }

    for (const record of records) {
        assert.deepEqual(await persistence.load(record.scope, now), record);
    }
    await persistence.clear({
        userId: 'driver-1',
        runId: 'run-1',
        targetStopId: 101,
        expectedRetryAttempt: 1,
    });
    assert.ok(await persistence.load(first.scope, now));
    assert.equal(await persistence.load(second.scope, now), null);
    assert.ok(await persistence.load(tenthAttempt.scope, now));
    assert.ok(await persistence.load(third.scope, now));
    assert.ok(await persistence.load(fourth.scope, now));

    await persistence.clear({ userId: 'driver-1', runId: 'run-1' });
    assert.equal(await persistence.load(first.scope, now), null);
    assert.equal(await persistence.load(second.scope, now), null);
    assert.equal(await persistence.load(tenthAttempt.scope, now), null);
    assert.equal(await persistence.load(third.scope, now), null);
    assert.ok(await persistence.load(fourth.scope, now));
});

test('cache expires records and never persists queued raw trace values', async () => {
    const storage = new MemoryWebStorage();
    const persistence =
        createWebStorageDeliveryHandoffManifestCachePersistence(storage);
    const record = createDeliveryHandoffManifestCacheRecord({
        userId: 'driver-1',
        manifest: manifest(),
        now,
    });
    await persistence.save(record);

    assert.equal(
        Array.from(storage.values.values()).some((value) =>
            value.includes('/trag/'),
        ),
        false,
    );
    assert.deepEqual(await persistence.load(record.scope, now), record);
    assert.equal(
        await persistence.load(
            record.scope,
            new Date(now.getTime() + deliveryHandoffManifestCacheTtlMs),
        ),
        null,
    );
    assert.equal(storage.length, 0);
});

test('a durable load mirrors the manifest before storage degradation', async () => {
    const storage = new MemoryWebStorage();
    const writer =
        createWebStorageDeliveryHandoffManifestCachePersistence(storage);
    const record = createDeliveryHandoffManifestCacheRecord({
        userId: 'driver-1',
        manifest: manifest(),
        now,
    });
    await writer.save(record);
    const reader =
        createWebStorageDeliveryHandoffManifestCachePersistence(storage);
    assert.deepEqual(await reader.load(record.scope, now), record);

    storage.failReads = true;
    assert.deepEqual(await reader.load(record.scope, now), record);
    assert.equal(reader.durability, 'memory');
});

test('cache cleanup prunes other runs and fails closed when durable removal is unconfirmed', async () => {
    const storage = new MemoryWebStorage();
    const persistence =
        createWebStorageDeliveryHandoffManifestCachePersistence(storage);
    const active = createDeliveryHandoffManifestCacheRecord({
        userId: 'driver-1',
        manifest: manifest(),
        now,
    });
    const stale = createDeliveryHandoffManifestCacheRecord({
        userId: 'driver-1',
        manifest: manifest({ runId: 'run-old' }),
        now,
    });
    await persistence.save(active);
    await persistence.save(stale);

    await persistence.clearOtherRuns?.({
        userId: 'driver-1',
        activeRunId: 'run-1',
    });
    assert.ok(await persistence.load(active.scope, now));
    assert.equal(await persistence.load(stale.scope, now), null);

    storage.failRemoval = true;
    await assert.rejects(
        persistence.clear({ userId: 'driver-1', runId: 'run-1' }),
        /cleanup could not be confirmed/,
    );
    assert.equal(persistence.durability, 'memory');
});
