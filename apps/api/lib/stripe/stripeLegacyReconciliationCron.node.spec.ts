import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { handleLegacyStripeReconciliationCron } from './stripeLegacyReconciliationCron';

function configureCronSecret(t: TestContext) {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    process.env.CRON_SECRET = 'cron-secret';
}

function cronRequest(authorization?: string) {
    return new Request('https://api.gredice.com/api/stripe/cron', {
        headers: authorization ? { authorization } : undefined,
    });
}

test('legacy reconciliation fails closed before maintenance or Stripe work', async (t) => {
    configureCronSecret(t);
    let calls = 0;
    const dependencies = {
        getSessions: async () => {
            calls += 1;
            return [];
        },
        maintenanceEnabled: () => {
            calls += 1;
            return true;
        },
        process: async () => {
            calls += 1;
        },
    };

    const invalid = await handleLegacyStripeReconciliationCron(
        cronRequest('Bearer wrong'),
        dependencies,
    );
    assert.strictEqual(invalid.status, 401);
    assert.strictEqual(calls, 0);

    delete process.env.CRON_SECRET;
    const missing = await handleLegacyStripeReconciliationCron(
        cronRequest('Bearer undefined'),
        dependencies,
    );
    assert.strictEqual(missing.status, 401);
    assert.strictEqual(calls, 0);
});

test('authenticated legacy reconciliation is retryable and idle during maintenance', async (t) => {
    configureCronSecret(t);
    t.mock.method(console, 'warn', () => undefined);
    let stripeCalls = 0;
    const response = await handleLegacyStripeReconciliationCron(
        cronRequest('Bearer cron-secret'),
        {
            getSessions: async () => {
                stripeCalls += 1;
                return [];
            },
            maintenanceEnabled: () => true,
            process: async () => {
                stripeCalls += 1;
            },
        },
    );

    assert.strictEqual(response.status, 503);
    assert.strictEqual(response.headers.get('retry-after'), '60');
    assert.strictEqual(stripeCalls, 0);
    assert.deepStrictEqual(await response.json(), {
        maintenance: true,
        success: false,
    });
});

test('legacy reconciliation retains its three-day scan when maintenance is disabled', async (t) => {
    configureCronSecret(t);
    const observedAt = new Date('2026-08-03T12:00:00.000Z');
    const scannedFrom: Date[] = [];
    const processed: string[] = [];
    const response = await handleLegacyStripeReconciliationCron(
        cronRequest('Bearer cron-secret'),
        {
            getSessions: async (from) => {
                scannedFrom.push(from);
                return [{ id: 'cs_1' }, { id: 'cs_2' }];
            },
            maintenanceEnabled: () => false,
            now: () => new Date(observedAt),
            process: async (id) => {
                if (id) processed.push(id);
            },
        },
    );

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
        scannedFrom[0]?.toISOString(),
        '2026-07-31T12:00:00.000Z',
    );
    assert.deepStrictEqual(processed, ['cs_1', 'cs_2']);
    assert.deepStrictEqual(await response.json(), {
        processedCheckoutSessions: 2,
        success: true,
    });
});
