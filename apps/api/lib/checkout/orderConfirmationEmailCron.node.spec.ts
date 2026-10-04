import assert from 'node:assert/strict';
import test from 'node:test';
import type { OrderConfirmationOutboxHealthSnapshot } from '@gredice/storage';
import { handleOrderConfirmationEmailCron } from './orderConfirmationEmailCron';
import type { OrderConfirmationEmailWorkerResult } from './orderConfirmationEmailWorker';

const successfulResult: OrderConfirmationEmailWorkerResult = {
    claimFailures: 0,
    claimed: 2,
    durationMs: 12,
    exhausted: 0,
    failed: 0,
    failureCategories: {
        configuration_error: 0,
        invalid_payload: 0,
        provider_rejected_retryable: 0,
        provider_rejected_terminal: 0,
        provider_submission_uncertain: 0,
        render_failed: 0,
        transport_before_submission: 0,
        worker_error_before_submission: 0,
    },
    finalizationFailures: 0,
    invalid: 0,
    oldestQueueAgeMs: 12_000,
    queuedForRetry: 0,
    reconciliation: {
        claimFailures: 0,
        claimed: 0,
        finalizationFailures: 0,
        lookupFailures: 0,
        pending: 0,
        sent: 0,
        terminalFailures: 0,
    },
    sent: 2,
    stoppedForTimeBudget: false,
    terminalFailures: 0,
    uncertain: 0,
};

const observedAt = new Date('2026-08-03T09:15:00.000Z');
const healthyOutbox: OrderConfirmationOutboxHealthSnapshot = {
    fencedSubmissions: {
        count: 0,
        oldestFencedAt: null,
        oldestStaleAt: null,
        staleCount: 0,
    },
    observedAt: observedAt.toISOString(),
    pendingQueued: {
        count: 0,
        dueCount: 0,
        oldestDueAt: null,
        oldestQueuedAt: null,
    },
    preSubmissionClaims: {
        expiredCount: 0,
        inFlightCount: 0,
        oldestExpiredClaimedAt: null,
        oldestInFlightClaimedAt: null,
    },
    reconciliation: {
        claimedCount: 0,
        dueCount: 0,
        expiredClaimCount: 0,
        oldestClaimedAt: null,
        oldestPendingAt: null,
        oldestStaleAt: null,
        pendingCount: 0,
        staleCount: 0,
    },
    staleBefore: '2026-08-03T09:05:00.000Z',
    staleSubmissionStarted: { count: 0, oldestStartedAt: null },
    submissionUncertain: {
        count: 0,
        oldestStaleUncertainAt: null,
        oldestUncertainAt: null,
        staleCount: 0,
    },
    terminalFailures: {
        count: 0,
        oldestFailedAt: null,
        retryExhaustedCount: 0,
    },
};

function successfulDependencies(
    run: () => Promise<OrderConfirmationEmailWorkerResult> = async () =>
        successfulResult,
) {
    return {
        health: async () => healthyOutbox,
        now: () => observedAt,
        run,
    };
}

function request(authorization?: string) {
    return new Request(
        'https://api.gredice.com/api/internal/cron/order-confirmation-emails',
        { headers: authorization ? { authorization } : undefined },
    );
}

test('order confirmation email cron rejects missing configuration and invalid authorization', async (t) => {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    let runs = 0;
    const dependencies = {
        run: async () => {
            runs += 1;
            return successfulResult;
        },
    };

    delete process.env.CRON_SECRET;
    const unconfigured = await handleOrderConfirmationEmailCron(
        request('Bearer undefined'),
        dependencies,
    );
    assert.equal(unconfigured.status, 401);
    assert.equal(
        unconfigured.headers.get('cache-control'),
        'private, no-store',
    );

    process.env.CRON_SECRET = 'cron-secret';
    const unauthorized = await handleOrderConfirmationEmailCron(
        request('Bearer wrong'),
        dependencies,
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(runs, 0);
});

test('order confirmation email cron returns bounded batch results', async (t) => {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    process.env.CRON_SECRET = 'cron-secret';

    const response = await handleOrderConfirmationEmailCron(
        request('Bearer cron-secret'),
        successfulDependencies(),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        success: true,
        ...successfulResult,
        outboxHealth: healthyOutbox,
    });
});

test('order confirmation email cron surfaces retry, terminal, and fenced failures as unhealthy', async (t) => {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    process.env.CRON_SECRET = 'cron-secret';

    for (const unhealthyResult of [
        { ...successfulResult, failed: 1, queuedForRetry: 1 },
        { ...successfulResult, terminalFailures: 1 },
        { ...successfulResult, uncertain: 1 },
        { ...successfulResult, exhausted: 1 },
        { ...successfulResult, invalid: 1 },
    ]) {
        const response = await handleOrderConfirmationEmailCron(
            request('Bearer cron-secret'),
            successfulDependencies(async () => unhealthyResult),
        );
        assert.equal(response.status, 503);
        assert.equal((await response.json()).success, false);
    }
});

test('order confirmation email cron stays unhealthy until stale fences and terminal failures are reconciled', async (t) => {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    process.env.CRON_SECRET = 'cron-secret';

    for (const unhealthyHealth of [
        {
            ...healthyOutbox,
            staleSubmissionStarted: {
                count: 1,
                oldestStartedAt: '2026-08-03T09:00:00.000Z',
            },
        },
        {
            ...healthyOutbox,
            submissionUncertain: {
                count: 1,
                oldestStaleUncertainAt: null,
                oldestUncertainAt: '2026-08-03T09:14:00.000Z',
                staleCount: 0,
            },
        },
        {
            ...healthyOutbox,
            terminalFailures: {
                count: 1,
                oldestFailedAt: '2026-08-03T09:14:00.000Z',
                retryExhaustedCount: 0,
            },
        },
        {
            ...healthyOutbox,
            pendingQueued: {
                count: 1,
                dueCount: 1,
                oldestDueAt: '2026-08-03T09:00:00.000Z',
                oldestQueuedAt: '2026-08-03T09:00:00.000Z',
            },
        },
    ]) {
        const response = await handleOrderConfirmationEmailCron(
            request('Bearer cron-secret'),
            {
                ...successfulDependencies(),
                health: async () => unhealthyHealth,
            },
        );
        assert.equal(response.status, 503);
        assert.equal((await response.json()).success, false);
    }
});

test('order confirmation email cron keeps internal failures private', async (t) => {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    process.env.CRON_SECRET = 'cron-secret';
    const privateSentinel = 'PRIVATE_ORDER_CONFIRMATION_CRON_SENTINEL';
    const logged: unknown[] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => logged.push(args));

    const response = await handleOrderConfirmationEmailCron(
        request('Bearer cron-secret'),
        {
            run: async () => {
                throw new Error(privateSentinel);
            },
        },
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { success: false });
    assert.equal(JSON.stringify(logged).includes(privateSentinel), false);
});
