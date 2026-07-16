import assert from 'node:assert/strict';
import test from 'node:test';
import { handleDeliveryLifecycleReconciliationCron } from './deliveryLifecycleReconciliationCron';

function request(authorization?: string) {
    return new Request(
        'https://api.gredice.com/api/internal/cron/delivery-lifecycle-reconciliation',
        { headers: authorization ? { authorization } : undefined },
    );
}

test('delivery lifecycle reconciliation cron requires CRON_SECRET', async (t) => {
    const previous = process.env.CRON_SECRET;
    t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
    });
    delete process.env.CRON_SECRET;
    let runs = 0;
    const response = await handleDeliveryLifecycleReconciliationCron(
        request('Bearer undefined'),
        async () => {
            runs += 1;
            return {
                enabled: true,
                failed: 0,
                missing: 0,
                published: 0,
                scanned: 0,
                skipped: 0,
            };
        },
    );
    assert.equal(response.status, 401);
    assert.equal(runs, 0);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('delivery lifecycle reconciliation cron returns bounded batch results', async (t) => {
    const previous = process.env.CRON_SECRET;
    t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
    });
    process.env.CRON_SECRET = 'cron-secret';
    const result = {
        enabled: true,
        failed: 1,
        missing: 2,
        published: 1,
        scanned: 3,
        skipped: 0,
    };
    const response = await handleDeliveryLifecycleReconciliationCron(
        request('Bearer cron-secret'),
        async () => result,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: false, ...result });
});

test('delivery lifecycle reconciliation cron keeps failures private', async (t) => {
    const previous = process.env.CRON_SECRET;
    t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
    });
    process.env.CRON_SECRET = 'cron-secret';
    const privateSentinel = 'PRIVATE_RECONCILIATION_SENTINEL';
    const logged: unknown[] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => logged.push(args));
    const response = await handleDeliveryLifecycleReconciliationCron(
        request('Bearer cron-secret'),
        async () => {
            throw new Error(privateSentinel);
        },
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { success: false });
    assert.equal(JSON.stringify(logged).includes(privateSentinel), false);
});
