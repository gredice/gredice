import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import {
    handleOutletLifecycleCron,
    handleStripeCheckoutOrphanRecoveryCron,
} from './outletLifecycleCron';

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
function request(authorization = 'Bearer cron-secret') {
    return new Request('https://api.gredice.com/api/internal/cron/test', {
        headers: { authorization },
    });
}
function dependencies() {
    return {
        cleanup: async () => ({
            closedOfferIds: [7],
            releasedReservationIds: [11, 12],
        }),
        drainPreflight: async () => true,
        maintenanceEnabled: () => false,
        now: () => observedAt,
        reconcile: async () => healthyReconciliation,
    };
}

test('both cron paths fail closed before invoking any business dependency', async (t) => {
    configureCronSecret(t);
    const idle = () => {
        throw new Error('Unauthorized work must remain idle');
    };
    for (const handler of [
        handleOutletLifecycleCron,
        handleStripeCheckoutOrphanRecoveryCron,
    ]) {
        const invalid = await handler(request('Bearer wrong'), {
            cleanup: idle,
            drainPreflight: idle,
            maintenanceEnabled: idle,
            reconcile: idle,
        });
        assert.equal(invalid.status, 401);
        assert.equal(invalid.headers.get('cache-control'), 'private, no-store');
        delete process.env.CRON_SECRET;
        assert.equal(
            (await handler(request(), { cleanup: idle, reconcile: idle }))
                .status,
            401,
        );
        process.env.CRON_SECRET = 'cron-secret';
    }
});

test('hourly outlet cleanup runs independently of Stripe recovery and maintenance', async (t) => {
    configureCronSecret(t);
    const idle = () => {
        throw new Error('Stripe dependency must remain idle');
    };
    const response = await handleOutletLifecycleCron(request(), {
        ...dependencies(),
        maintenanceEnabled: idle,
        reconcile: idle,
        drainPreflight: idle,
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.closedOffersCount, 1);
    assert.equal(body.releasedReservationsCount, 2);
    assert.equal(body.reconciliation, null);
});

test('five-minute recovery never repeats outlet cleanup', async (t) => {
    configureCronSecret(t);
    const response = await handleStripeCheckoutOrphanRecoveryCron(request(), {
        ...dependencies(),
        cleanup: async () => {
            throw new Error('Cleanup must stay idle');
        },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(
        (await response.json()).reconciliation,
        healthyReconciliation,
    );
});

test('recovery maintenance skips reconciliation and reports the drain preflight', async (t) => {
    configureCronSecret(t);
    t.mock.method(console, 'warn', () => undefined);
    const response = await handleStripeCheckoutOrphanRecoveryCron(request(), {
        ...dependencies(),
        maintenanceEnabled: () => true,
        reconcile: async () => {
            throw new Error('Reconciliation must remain idle');
        },
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '60');
    const body = await response.json();
    assert.equal(body.stripePaymentProcessingDrained, true);
    assert.equal(body.reconciliation, null);
});

test('maintenance reports a private drain preflight failure', async (t) => {
    configureCronSecret(t);
    t.mock.method(console, 'error', () => undefined);
    t.mock.method(console, 'warn', () => undefined);
    const response = await handleStripeCheckoutOrphanRecoveryCron(request(), {
        ...dependencies(),
        maintenanceEnabled: () => true,
        drainPreflight: async () => {
            throw new Error('private checkout data');
        },
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.stripePaymentProcessingDrained, null);
    assert.equal(body.stripePaymentProcessingDrainFailureCategory, 'Error');
    assert.equal(JSON.stringify(body).includes('private checkout data'), false);
});

test('incomplete and failed recovery remain unhealthy', async (t) => {
    configureCronSecret(t);
    for (const reconciliation of [
        { ...healthyReconciliation, failedCount: 1 },
        { ...healthyReconciliation, truncated: true },
    ]) {
        const response = await handleStripeCheckoutOrphanRecoveryCron(
            request(),
            {
                ...dependencies(),
                reconcile: async () => reconciliation,
            },
        );
        assert.equal(response.status, 503);
    }
});

test('cleanup failures remain retryable without invoking recovery', async (t) => {
    configureCronSecret(t);
    t.mock.method(console, 'error', () => undefined);
    const response = await handleOutletLifecycleCron(request(), {
        ...dependencies(),
        cleanup: async () => {
            throw new Error('unavailable');
        },
        reconcile: async () => {
            throw new Error('Recovery must stay idle');
        },
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).cleanupFailureCategory, 'Error');
});
