import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { handleOutletLifecycleCron } from './outletLifecycleCron';

const observedAt = new Date('2026-08-03T09:15:00.000Z');
const healthyReconciliation = {
    boundCount: 0,
    failedCount: 0,
    failureCategories: {},
    missRecordedCount: 0,
    processedCount: 0,
    releasedCount: 0,
    retainedCount: 0,
    scannedCount: 0,
    truncated: false,
};

function configureCronSecret(t: TestContext) {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    process.env.CRON_SECRET = 'cron-secret';
}

function cronRequest(authorization?: string) {
    return new Request(
        'https://api.gredice.com/api/internal/cron/outlet-lifecycle',
        { headers: authorization ? { authorization } : undefined },
    );
}

test('outlet lifecycle cron fails closed before cleanup and reconciliation', async (t) => {
    configureCronSecret(t);
    let calls = 0;
    const dependencies = {
        cleanup: async () => {
            calls += 1;
            return { closedOfferIds: [], releasedReservationIds: [] };
        },
        drainPreflight: async () => {
            calls += 1;
            return true;
        },
        maintenanceEnabled: () => {
            calls += 1;
            return false;
        },
        reconcile: async () => {
            calls += 1;
            return healthyReconciliation;
        },
    };

    const invalid = await handleOutletLifecycleCron(
        cronRequest('Bearer wrong'),
        dependencies,
    );
    assert.strictEqual(invalid.status, 401);
    assert.strictEqual(
        invalid.headers.get('cache-control'),
        'private, no-store',
    );
    assert.strictEqual(calls, 0);

    delete process.env.CRON_SECRET;
    const missing = await handleOutletLifecycleCron(
        cronRequest('Bearer undefined'),
        dependencies,
    );
    assert.strictEqual(missing.status, 401);
    assert.strictEqual(calls, 0);
});

test('maintenance keeps outlet cleanup active and skips orphan reconciliation', async (t) => {
    configureCronSecret(t);
    t.mock.method(console, 'warn', () => undefined);
    let cleanupCalls = 0;
    let drainPreflightCalls = 0;
    let reconciliationCalls = 0;
    const response = await handleOutletLifecycleCron(
        cronRequest('Bearer cron-secret'),
        {
            cleanup: async () => {
                cleanupCalls += 1;
                return {
                    closedOfferIds: [7, 8],
                    releasedReservationIds: [11],
                };
            },
            drainPreflight: async () => {
                drainPreflightCalls += 1;
                return true;
            },
            maintenanceEnabled: () => true,
            now: () => observedAt,
            reconcile: async () => {
                reconciliationCalls += 1;
                return healthyReconciliation;
            },
        },
    );

    assert.strictEqual(response.status, 503);
    assert.strictEqual(response.headers.get('retry-after'), '60');
    assert.strictEqual(
        response.headers.get('cache-control'),
        'private, no-store',
    );
    assert.strictEqual(cleanupCalls, 1);
    assert.strictEqual(drainPreflightCalls, 1);
    assert.strictEqual(reconciliationCalls, 0);
    assert.deepStrictEqual(await response.json(), {
        cleanupFailureCategory: null,
        closedOffersCount: 2,
        maintenance: true,
        stripePaymentProcessingDrainFailureCategory: null,
        stripePaymentProcessingDrained: true,
        reconciliation: null,
        reconciliationFailureCategory: null,
        releasedReservationsCount: 1,
        success: false,
        timestamp: observedAt.toISOString(),
    });
});

test('maintenance reports a drain preflight failure without checkout data', async (t) => {
    configureCronSecret(t);
    t.mock.method(console, 'error', () => undefined);
    t.mock.method(console, 'warn', () => undefined);
    class DrainPreflightError extends Error {
        override readonly name = 'DrainPreflightError';
    }
    let reconciliationCalls = 0;
    const response = await handleOutletLifecycleCron(
        cronRequest('Bearer cron-secret'),
        {
            cleanup: async () => ({
                closedOfferIds: [],
                releasedReservationIds: [],
            }),
            drainPreflight: async () => {
                throw new DrainPreflightError('database unavailable');
            },
            maintenanceEnabled: () => true,
            now: () => observedAt,
            reconcile: async () => {
                reconciliationCalls += 1;
                return healthyReconciliation;
            },
        },
    );

    assert.strictEqual(response.status, 503);
    assert.strictEqual(reconciliationCalls, 0);
    const body = await response.json();
    assert.strictEqual(body.stripePaymentProcessingDrained, null);
    assert.strictEqual(
        body.stripePaymentProcessingDrainFailureCategory,
        'DrainPreflightError',
    );
});

test('outlet lifecycle cron preserves normal cleanup and orphan reconciliation', async (t) => {
    configureCronSecret(t);
    const response = await handleOutletLifecycleCron(
        cronRequest('Bearer cron-secret'),
        {
            cleanup: async () => ({
                closedOfferIds: [7],
                releasedReservationIds: [11, 12],
            }),
            drainPreflight: async () => {
                throw new Error('drain preflight must stay idle');
            },
            maintenanceEnabled: () => false,
            now: () => observedAt,
            reconcile: async () => healthyReconciliation,
        },
    );

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('retry-after'), null);
    assert.strictEqual(
        response.headers.get('cache-control'),
        'private, no-store',
    );
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.maintenance, false);
    assert.strictEqual(body.stripePaymentProcessingDrained, null);
    assert.strictEqual(body.stripePaymentProcessingDrainFailureCategory, null);
    assert.strictEqual(body.closedOffersCount, 1);
    assert.strictEqual(body.releasedReservationsCount, 2);
    assert.deepStrictEqual(body.reconciliation, healthyReconciliation);
});
