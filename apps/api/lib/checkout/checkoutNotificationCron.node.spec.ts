import assert from 'node:assert/strict';
import test from 'node:test';
import type { CheckoutNotificationOutboxHealth } from '@gredice/storage';
import { handleCheckoutNotificationCron } from './checkoutNotificationCron';
import type { CheckoutNotificationWorkerResult } from './checkoutNotificationWorker';

const successfulResult: CheckoutNotificationWorkerResult = {
    claimFailures: 0,
    claimed: 2,
    durationMs: 12,
    exhausted: 0,
    failed: 0,
    finalizationFailures: 0,
    invalid: 0,
    oldestQueueAgeMs: 1_000,
    queuedForRetry: 0,
    sent: 2,
    skipped: 0,
    stoppedForTimeBudget: false,
    terminalFailures: 0,
    uncertain: 0,
};
const observedAt = new Date('2026-08-03T09:15:00.000Z');
const healthyOutbox: CheckoutNotificationOutboxHealth = {
    claimedCount: 0,
    dueCount: 0,
    failedCount: 0,
    fencedCount: 0,
    oldestDueAt: null,
    oldestFencedAt: null,
    observedAt: observedAt.toISOString(),
    queuedCount: 0,
    retryExhaustedCount: 0,
    staleClaimedCount: 0,
    staleFencedCount: 0,
};

function request(authorization?: string) {
    return new Request(
        'https://api.gredice.com/api/internal/cron/checkout-notifications',
        { headers: authorization ? { authorization } : undefined },
    );
}

test('checkout notification cron is fail-closed', async (t) => {
    const previous = process.env.CRON_SECRET;
    t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
    });
    let runs = 0;
    const dependencies = {
        run: async () => {
            runs += 1;
            return successfulResult;
        },
    };

    delete process.env.CRON_SECRET;
    assert.equal(
        (await handleCheckoutNotificationCron(request(), dependencies)).status,
        401,
    );
    process.env.CRON_SECRET = 'cron-secret';
    assert.equal(
        (
            await handleCheckoutNotificationCron(
                request('Bearer wrong'),
                dependencies,
            )
        ).status,
        401,
    );
    assert.equal(runs, 0);
});

test('checkout notification cron returns aggregate health', async (t) => {
    const previous = process.env.CRON_SECRET;
    t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
    });
    process.env.CRON_SECRET = 'cron-secret';
    const response = await handleCheckoutNotificationCron(
        request('Bearer cron-secret'),
        {
            health: async () => healthyOutbox,
            now: () => observedAt,
            run: async () => successfulResult,
        },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        success: true,
        ...successfulResult,
        outboxHealth: healthyOutbox,
    });
});

test('fenced, failed, and stale intents make cron unhealthy', async (t) => {
    const previous = process.env.CRON_SECRET;
    t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
    });
    process.env.CRON_SECRET = 'cron-secret';

    for (const unhealthy of [
        { ...healthyOutbox, failedCount: 1 },
        { ...healthyOutbox, fencedCount: 1 },
        { ...healthyOutbox, staleClaimedCount: 1 },
        {
            ...healthyOutbox,
            oldestDueAt: '2026-08-03T09:00:00.000Z',
            queuedCount: 1,
        },
    ]) {
        const response = await handleCheckoutNotificationCron(
            request('Bearer cron-secret'),
            {
                health: async () => unhealthy,
                now: () => observedAt,
                run: async () => successfulResult,
            },
        );
        assert.equal(response.status, 503);
    }
});
