import assert from 'node:assert/strict';
import test from 'node:test';
import type { DeliveryLifecycleNotificationHealth } from '@gredice/storage';
import {
    handleDeliveryNotificationHealthCron,
    readDeliveryNotificationHealthEnabled,
    runDeliveryNotificationHealth,
} from './deliveryNotificationHealth';

const now = new Date('2026-07-16T12:00:00.000Z');

function health(
    overrides: Partial<DeliveryLifecycleNotificationHealth> = {},
): DeliveryLifecycleNotificationHealth {
    return {
        alerts: {
            ambiguousEmailSending: false,
            retryExhausted: false,
            staleEligibleQueue: false,
            systemicFailure: false,
        },
        ambiguousEmailSendingCount: 0,
        channels: [],
        from: new Date(now.getTime() - 15 * 60 * 1_000),
        retryExhaustedCount: 0,
        severity: 'healthy',
        staleEligibleQueueCount: 0,
        to: now,
        ...overrides,
    };
}

function request(authorization?: string) {
    return new Request(
        'https://api.gredice.com/api/internal/cron/delivery-notification-health',
        { headers: authorization ? { authorization } : undefined },
    );
}

test('delivery notification health is default-off and does not query storage', async () => {
    assert.equal(readDeliveryNotificationHealthEnabled(undefined), false);
    assert.equal(readDeliveryNotificationHealthEnabled('true'), true);
    const result = await runDeliveryNotificationHealth({
        dependencies: {
            getHealth: async () => {
                throw new Error('Storage must not be queried while disabled.');
            },
        },
        enabled: false,
        now,
    });
    assert.deepEqual(result, { enabled: false, severity: 'disabled' });
});

test('delivery notification health logs only aggregate warning and queue context', async (t) => {
    const logged: unknown[] = [];
    t.mock.method(console, 'warn', (...args: unknown[]) => logged.push(args));
    t.mock.method(console, 'error', (...args: unknown[]) => logged.push(args));
    const result = await runDeliveryNotificationHealth({
        dependencies: {
            getHealth: async () =>
                health({
                    alerts: {
                        ambiguousEmailSending: true,
                        retryExhausted: true,
                        staleEligibleQueue: true,
                        systemicFailure: true,
                    },
                    ambiguousEmailSendingCount: 1,
                    channels: [
                        {
                            channel: 'push',
                            failureCount: 3,
                            failureRate: 0.3,
                            severity: 'warning',
                            terminalCount: 10,
                        },
                    ],
                    retryExhaustedCount: 2,
                    severity: 'warning',
                    staleEligibleQueueCount: 5,
                }),
        },
        enabled: true,
        now,
    });
    assert.equal(result.severity, 'warning');
    assert.equal(logged.length, 4);
    const serialized = JSON.stringify(logged);
    assert.equal(serialized.includes('notificationId'), false);
    assert.equal(serialized.includes('requestId'), false);
    assert.equal(serialized.includes('accountId'), false);
    assert.equal(serialized.includes('userId'), false);
});

test('health cron rejects invalid auth and returns 503 only for systemic critical health', async (t) => {
    const previous = process.env.CRON_SECRET;
    t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
    });
    process.env.CRON_SECRET = 'cron-secret';
    let runs = 0;
    const dependencies = {
        run: async () => {
            runs += 1;
            return {
                enabled: true as const,
                ...health({ severity: 'critical' }),
            };
        },
    };
    assert.equal(
        (await handleDeliveryNotificationHealthCron(request(), dependencies))
            .status,
        401,
    );
    assert.equal(runs, 0);
    const critical = await handleDeliveryNotificationHealthCron(
        request('Bearer cron-secret'),
        dependencies,
    );
    assert.equal(critical.status, 503);
    assert.equal((await critical.json()).success, false);

    const disabled = await handleDeliveryNotificationHealthCron(
        request('Bearer cron-secret'),
        {
            run: async () => ({ enabled: false, severity: 'disabled' }),
        },
    );
    assert.equal(disabled.status, 200);
    assert.equal((await disabled.json()).success, true);
});

test('health cron keeps failures private', async (t) => {
    const previous = process.env.CRON_SECRET;
    t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
    });
    process.env.CRON_SECRET = 'cron-secret';
    const privateSentinel = 'PRIVATE_HEALTH_SENTINEL_8675309';
    const logged: unknown[] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => logged.push(args));
    const response = await handleDeliveryNotificationHealthCron(
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
