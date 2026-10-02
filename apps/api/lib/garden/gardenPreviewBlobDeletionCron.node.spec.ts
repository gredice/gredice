import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { handleGardenPreviewBlobDeletionCron } from './gardenPreviewBlobDeletionCron';

const now = new Date('2026-10-02T03:00:00.000Z');
function setup(t: TestContext) {
    const previous = process.env.CRON_SECRET;
    t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
    });
    process.env.CRON_SECRET = 'secret';
}
function request(authorization = 'Bearer secret') {
    return new Request(
        'https://api.gredice.com/api/internal/cron/garden-preview-blob-deletions',
        {
            headers: { authorization },
        },
    );
}
function row(id: number) {
    return {
        id,
        pathname: `garden/${id}.webp`,
        imageUrl: `https://blob.test/${id}`,
        reason: 'deleted',
        attempts: 2,
        lastError: null,
        lastAttemptAt: null,
        nextAttemptAt: now,
        claimId: null,
        claimExpiresAt: null,
        createdAt: now,
        updatedAt: now,
    };
}
function dependencies() {
    return {
        claim: async () => [row(1)],
        complete: async ({ ids }: { ids: number[] }) => ids.length,
        fail: async ({ failures }: { failures: { id: number }[] }) =>
            failures.length,
        deleteBlob: async () => {},
        now: () => now,
    };
}

test('daily cleanup rejects invalid auth without opening storage', async (t) => {
    setup(t);
    const response = await handleGardenPreviewBlobDeletionCron(
        request('Bearer invalid'),
        {
            claim: async () => {
                throw new Error('Must remain idle');
            },
        },
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('daily window drains multiple bounded batches above the old 100-row limit', async (t) => {
    setup(t);
    let nextId = 1;
    let claimCount = 0;
    const response = await handleGardenPreviewBlobDeletionCron(request(), {
        ...dependencies(),
        claim: async (options) => {
            assert.equal(options.limit, 100);
            assert.equal(options.expiresAt.getTime() - now.getTime(), 60_000);
            claimCount += 1;
            return Array.from({ length: Math.min(100, 251 - nextId) }, () =>
                row(nextId++),
            );
        },
    });
    assert.equal(response.status, 200);
    assert.equal(claimCount, 3);
    const body = await response.json();
    assert.equal(body.deleted, 250);
    assert.equal(body.capacityReached, false);
});

test('failed deletion retains durable retry metadata and succeeds independently for other rows', async (t) => {
    setup(t);
    t.mock.method(console, 'warn', () => undefined);
    let completed: number[] = [];
    const response = await handleGardenPreviewBlobDeletionCron(request(), {
        ...dependencies(),
        claim: async () => [row(1), row(2)],
        deleteBlob: async (pathname) => {
            if (pathname === 'garden/1.webp')
                throw new Error('provider unavailable');
        },
        complete: async ({ ids }) => {
            completed = ids;
            return ids.length;
        },
        fail: async ({ failures, claimId }) => {
            assert.ok(claimId);
            assert.equal(failures.length, 1);
            assert.equal(failures[0]?.id, 1);
            assert.equal(
                failures[0]?.retryAt.getTime(),
                now.getTime() + 240_000,
            );
            return failures.length;
        },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(completed, [2]);
    const body = await response.json();
    assert.equal(body.deleted, 1);
    assert.equal(body.failed, 1);
});

test('capacity and elapsed-time limits keep unclaimed backlog durable and observable', async (t) => {
    setup(t);
    t.mock.method(console, 'warn', () => undefined);
    let claimCount = 0;
    const full = await handleGardenPreviewBlobDeletionCron(request(), {
        ...dependencies(),
        claim: async () => {
            claimCount += 1;
            return Array.from({ length: 100 }, (_, i) =>
                row(claimCount * 100 + i),
            );
        },
    });
    assert.equal(full.status, 503);
    assert.equal(claimCount, 10);
    assert.equal((await full.json()).claimed, 1_000);

    let elapsed = 0;
    claimCount = 0;
    const timed = await handleGardenPreviewBlobDeletionCron(request(), {
        ...dependencies(),
        now: () => new Date(now.getTime() + elapsed),
        claim: async () => {
            claimCount += 1;
            return Array.from({ length: 100 }, (_, i) => row(i));
        },
        complete: async ({ ids }) => {
            elapsed = 46_000;
            return ids.length;
        },
    });
    assert.equal(timed.status, 503);
    assert.equal(claimCount, 1);
    assert.equal((await timed.json()).capacityReached, true);
});

test('lost claim completion is an error instead of falsely reporting deleted rows', async (t) => {
    setup(t);
    t.mock.method(console, 'error', () => undefined);
    const response = await handleGardenPreviewBlobDeletionCron(request(), {
        ...dependencies(),
        complete: async () => 0,
    });
    assert.equal(response.status, 500);
    assert.equal((await response.json()).success, false);
});
