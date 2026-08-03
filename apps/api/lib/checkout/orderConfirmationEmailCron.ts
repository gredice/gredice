import {
    getOrderConfirmationOutboxHealthSnapshot,
    type OrderConfirmationOutboxHealthSnapshot,
} from '@gredice/storage';
import {
    type OrderConfirmationEmailWorkerResult,
    runOrderConfirmationEmailWorker,
} from './orderConfirmationEmailWorker';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };
const staleOutboxThresholdMilliseconds = 10 * 60 * 1000;

type OrderConfirmationEmailCronDependencies = {
    health: typeof getOrderConfirmationOutboxHealthSnapshot;
    now: () => Date;
    run: () => Promise<OrderConfirmationEmailWorkerResult>;
};

const defaultDependencies: OrderConfirmationEmailCronDependencies = {
    health: getOrderConfirmationOutboxHealthSnapshot,
    now: () => new Date(),
    run: runOrderConfirmationEmailWorker,
};

function workerRunIsHealthy(result: OrderConfirmationEmailWorkerResult) {
    return (
        result.claimFailures === 0 &&
        result.exhausted === 0 &&
        result.failed === 0 &&
        result.finalizationFailures === 0 &&
        result.invalid === 0 &&
        result.reconciliation.claimFailures === 0 &&
        result.reconciliation.finalizationFailures === 0 &&
        result.reconciliation.lookupFailures === 0 &&
        result.reconciliation.terminalFailures === 0 &&
        result.terminalFailures === 0 &&
        result.uncertain === 0
    );
}

function outboxHealthIsHealthy(health: OrderConfirmationOutboxHealthSnapshot) {
    const oldestDueIsStale =
        health.pendingQueued.oldestDueAt !== null &&
        health.pendingQueued.oldestDueAt <= health.staleBefore;
    return (
        !oldestDueIsStale &&
        health.preSubmissionClaims.expiredCount === 0 &&
        health.fencedSubmissions.count === 0 &&
        health.reconciliation.expiredClaimCount === 0 &&
        health.staleSubmissionStarted.count === 0 &&
        health.submissionUncertain.count === 0 &&
        health.terminalFailures.count === 0
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

export async function handleOrderConfirmationEmailCron(
    request: Request,
    dependencies: Partial<OrderConfirmationEmailCronDependencies> = {},
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
        const outboxHealth = await resolved.health({
            now: observedAt,
            staleBefore: new Date(
                observedAt.getTime() - staleOutboxThresholdMilliseconds,
            ),
        });
        console.info('order_confirmation_email.outbox.health', outboxHealth);
        const success =
            workerRunIsHealthy(result) && outboxHealthIsHealthy(outboxHealth);
        return Response.json(
            {
                success,
                ...result,
                outboxHealth,
            },
            { headers: noStoreHeaders, status: success ? 200 : 503 },
        );
    } catch (error) {
        console.error('Order confirmation email cron failed', {
            ...boundedErrorContext(error),
        });
        return Response.json(
            { success: false },
            { headers: noStoreHeaders, status: 500 },
        );
    }
}
