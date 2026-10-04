import {
    type CheckoutNotificationOutboxHealth,
    getCheckoutNotificationOutboxHealth,
} from '@gredice/storage';
import {
    type CheckoutNotificationWorkerResult,
    runCheckoutNotificationWorker,
} from './checkoutNotificationWorker';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };
const staleThresholdMilliseconds = 10 * 60_000;

type CronDependencies = {
    health: typeof getCheckoutNotificationOutboxHealth;
    now: () => Date;
    run: () => Promise<CheckoutNotificationWorkerResult>;
};

const defaultDependencies: CronDependencies = {
    health: getCheckoutNotificationOutboxHealth,
    now: () => new Date(),
    run: runCheckoutNotificationWorker,
};

function workerIsHealthy(result: CheckoutNotificationWorkerResult) {
    return (
        result.claimFailures === 0 &&
        result.exhausted === 0 &&
        result.failed === 0 &&
        result.finalizationFailures === 0 &&
        result.invalid === 0 &&
        result.terminalFailures === 0 &&
        result.uncertain === 0
    );
}

function outboxIsHealthy(
    health: CheckoutNotificationOutboxHealth,
    staleBefore: Date,
) {
    return (
        (health.oldestDueAt === null ||
            health.oldestDueAt > staleBefore.toISOString()) &&
        health.failedCount === 0 &&
        health.fencedCount === 0 &&
        health.staleClaimedCount === 0 &&
        health.staleFencedCount === 0
    );
}

function boundedErrorContext(error: unknown) {
    const errorName =
        error instanceof Error ? error.name.slice(0, 64) : 'Unknown';
    const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^[A-Za-z0-9._:-]{1,64}$/u.test(error.code)
            ? error.code
            : undefined;
    return { errorCode, errorName };
}

export async function handleCheckoutNotificationCron(
    request: Request,
    dependencies: Partial<CronDependencies> = {},
) {
    const resolved = { ...defaultDependencies, ...dependencies };
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (
        !cronSecret ||
        request.headers.get('authorization') !== `Bearer ${cronSecret}`
    ) {
        return new Response('Unauthorized', {
            headers: noStoreHeaders,
            status: 401,
        });
    }

    try {
        const result = await resolved.run();
        const observedAt = resolved.now();
        const staleBefore = new Date(
            observedAt.getTime() - staleThresholdMilliseconds,
        );
        const outboxHealth = await resolved.health({
            now: observedAt,
            staleBefore,
        });
        console.info('checkout_notification.outbox.health', outboxHealth);
        const success =
            workerIsHealthy(result) &&
            outboxIsHealthy(outboxHealth, staleBefore);
        return Response.json(
            { success, ...result, outboxHealth },
            { headers: noStoreHeaders, status: success ? 200 : 503 },
        );
    } catch (error) {
        console.error('Checkout notification cron failed', {
            ...boundedErrorContext(error),
        });
        return Response.json(
            { success: false },
            { headers: noStoreHeaders, status: 500 },
        );
    }
}
