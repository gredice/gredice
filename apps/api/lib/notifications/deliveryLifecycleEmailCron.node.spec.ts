import assert from 'node:assert/strict';
import test from 'node:test';
import { handleDeliveryLifecycleEmailCron } from './deliveryLifecycleEmailCron';
import {
    type DeliveryLifecycleEmailWorkerResult,
    runDeliveryLifecycleEmailWorker,
} from './deliveryLifecycleEmailWorker';

const successfulResult: DeliveryLifecycleEmailWorkerResult = {
    candidates: 2,
    claimFailures: 0,
    claimed: 2,
    deferred: 0,
    enabled: true,
    failed: 1,
    finalizationFailures: 0,
    invalidPayloads: 0,
    sent: 1,
    skipped: 0,
    unavailable: 0,
};

function request(authorization?: string) {
    return new Request(
        'https://api.gredice.com/api/internal/cron/delivery-lifecycle-emails',
        { headers: authorization ? { authorization } : undefined },
    );
}

test('delivery lifecycle email cron rejects missing configuration and invalid authorization', async (t) => {
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
    const unconfigured = await handleDeliveryLifecycleEmailCron(
        request('Bearer undefined'),
        dependencies,
    );
    assert.equal(unconfigured.status, 401);
    assert.equal(
        unconfigured.headers.get('cache-control'),
        'private, no-store',
    );

    process.env.CRON_SECRET = 'cron-secret';
    const unauthorized = await handleDeliveryLifecycleEmailCron(
        request('Bearer wrong'),
        dependencies,
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(runs, 0);
});

test('delivery lifecycle email cron returns bounded partial batch results', async (t) => {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    process.env.CRON_SECRET = 'cron-secret';

    const response = await handleDeliveryLifecycleEmailCron(
        request('Bearer cron-secret'),
        { run: async () => successfulResult },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        success: true,
        ...successfulResult,
    });
});

test('delivery lifecycle email cron keeps internal failures private', async (t) => {
    const previousSecret = process.env.CRON_SECRET;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    });
    process.env.CRON_SECRET = 'cron-secret';
    const privateSentinel = 'PRIVATE_CRON_SENTINEL_8675309';
    const logged: unknown[] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => logged.push(args));

    const response = await handleDeliveryLifecycleEmailCron(
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

test('default-off worker used by cron does not query storage', async () => {
    const previous = process.env.GREDICE_DELIVERY_NOTIFICATION_EMAIL_ENABLED;
    delete process.env.GREDICE_DELIVERY_NOTIFICATION_EMAIL_ENABLED;
    try {
        const result = await runDeliveryLifecycleEmailWorker({
            dependencies: {
                listCandidates: async () => {
                    throw new Error(
                        'Storage must not be queried while disabled.',
                    );
                },
            },
        });
        assert.equal(result.enabled, false);
        assert.equal(result.candidates, 0);
    } finally {
        if (previous === undefined) {
            delete process.env.GREDICE_DELIVERY_NOTIFICATION_EMAIL_ENABLED;
        } else {
            process.env.GREDICE_DELIVERY_NOTIFICATION_EMAIL_ENABLED = previous;
        }
    }
});
