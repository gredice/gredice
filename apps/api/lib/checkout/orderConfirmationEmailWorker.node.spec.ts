import assert from 'node:assert/strict';
import test from 'node:test';
import {
    EmailProviderSubmissionRejectedError,
    EmailProviderSubmissionUncertainError,
} from '@gredice/email/acs';
import type { OrderConfirmationEmailClaimResult } from '@gredice/storage';
import { runOrderConfirmationEmailWorker } from './orderConfirmationEmailWorker';

const operationId = '018f0d12-2ec4-7fab-9d91-91f890ad5d73';
const queuedAt = new Date('2026-08-03T09:00:00.000Z');
const now = new Date('2026-08-03T09:02:00.000Z');

type FailureCategories = {
    configuration_error: number;
    invalid_payload: number;
    provider_rejected_retryable: number;
    provider_rejected_terminal: number;
    provider_submission_uncertain: number;
    render_failed: number;
    transport_before_submission: number;
    worker_error_before_submission: number;
};

function failureCategories(
    overrides: Partial<FailureCategories> = {},
): FailureCategories {
    return {
        configuration_error: 0,
        invalid_payload: 0,
        provider_rejected_retryable: 0,
        provider_rejected_terminal: 0,
        provider_submission_uncertain: 0,
        render_failed: 0,
        transport_before_submission: 0,
        worker_error_before_submission: 0,
        ...overrides,
    };
}

function claim(): OrderConfirmationEmailClaimResult {
    return {
        claim: {
            attempt: 1,
            claimId: 'claim-1',
            emailMessageId: 42,
            maxAttempts: 3,
            operationId,
            payload: {
                cartId: 91,
                currency: null,
                items: [
                    {
                        amountSubtotal: 12,
                        currency: 'sunflower',
                        name: 'Bosiljak',
                        quantity: 1,
                    },
                ],
                manageUrl: 'https://vrt.gredice.com',
                to: 'customer@example.com',
                totalAmountCents: null,
            },
            queuedAt,
        },
        status: 'claimed',
    };
}

test('order confirmation worker starts, sends, and finalizes one claimed intent', async (t) => {
    const logged: unknown[] = [];
    t.mock.method(console, 'info', (...args: unknown[]) => logged.push(args));
    const calls: string[] = [];
    let claimCount = 0;

    const result = await runOrderConfirmationEmailWorker({
        reconciliationLimit: 0,
        dependencies: {
            abortSignal: (timeoutMilliseconds) => {
                assert.equal(timeoutMilliseconds, 45_000);
                return new AbortController().signal;
            },
            claim: async () => {
                claimCount += 1;
                return claimCount === 1 ? claim() : { status: 'empty' };
            },
            markSent: async () => {
                calls.push('finalize');
                return { status: 'sent' };
            },
            monotonicNow: () => 0,
            now: () => now,
            randomId: () => 'claim-1',
            send: async (_to, _config, options) => {
                if (!options) throw new Error('Expected send options.');
                calls.push('render');
                await options.beforeProviderSubmission?.();
                calls.push('send');
                return {
                    id: operationId,
                    status: 'Succeeded',
                };
            },
            start: async () => {
                calls.push('start');
                return { operationId, status: 'started' };
            },
        },
    });

    assert.deepEqual(calls, ['render', 'start', 'send', 'finalize']);
    assert.deepEqual(result, {
        claimFailures: 0,
        claimed: 1,
        durationMs: 0,
        exhausted: 0,
        failed: 0,
        failureCategories: failureCategories(),
        finalizationFailures: 0,
        invalid: 0,
        oldestQueueAgeMs: 120_000,
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
        sent: 1,
        stoppedForTimeBudget: false,
        terminalFailures: 0,
        uncertain: 0,
    });
    assert.deepEqual(logged, [
        ['order_confirmation_email.worker.complete', result],
    ]);
});

test('order confirmation worker fences a provider success when sent finalization throws', async (t) => {
    t.mock.method(console, 'info', () => undefined);
    t.mock.method(console, 'error', () => undefined);
    const calls: string[] = [];
    let claimCount = 0;
    let markFailedCalled = false;

    const result = await runOrderConfirmationEmailWorker({
        reconciliationLimit: 0,
        dependencies: {
            claim: async () => {
                claimCount += 1;
                return claimCount === 1 ? claim() : { status: 'empty' };
            },
            markFailed: async () => {
                markFailedCalled = true;
                return {
                    attempt: 1,
                    nextAttemptAt: new Date(now.getTime() + 60_000),
                    status: 'retry_scheduled',
                };
            },
            markSent: async () => {
                calls.push('finalize');
                throw new Error('database unavailable');
            },
            monotonicNow: () => 0,
            now: () => now,
            send: async (_to, _config, options) => {
                if (!options) throw new Error('Expected send options.');
                await options.beforeProviderSubmission?.();
                calls.push('send');
                return {
                    id: operationId,
                    status: 'Succeeded',
                };
            },
            start: async () => {
                calls.push('start');
                return { operationId, status: 'started' };
            },
        },
    });

    assert.deepEqual(calls, ['start', 'send', 'finalize']);
    assert.equal(markFailedCalled, false);
    assert.equal(result.failed, 0);
    assert.equal(result.finalizationFailures, 1);
    assert.equal(result.queuedForRetry, 0);
    assert.equal(result.sent, 0);
});

test('order confirmation worker retries a proven provider rejection', async (t) => {
    t.mock.method(console, 'info', () => undefined);
    let failure:
        | {
              failureCode: string;
              failureKind: string;
          }
        | undefined;
    let claimCount = 0;

    const result = await runOrderConfirmationEmailWorker({
        reconciliationLimit: 0,
        dependencies: {
            claim: async () => {
                claimCount += 1;
                return claimCount === 1 ? claim() : { status: 'empty' };
            },
            markFailed: async (input) => {
                failure = input;
                return {
                    attempt: 1,
                    nextAttemptAt: new Date(now.getTime() + 60_000),
                    status: 'retry_scheduled',
                };
            },
            now: () => now,
            send: async (_to, _config, options) => {
                if (!options) throw new Error('Expected send options.');
                await options.beforeProviderSubmission?.();
                throw new EmailProviderSubmissionRejectedError(429);
            },
            start: async () => ({ operationId, status: 'started' }),
        },
    });

    assert.equal(result.queuedForRetry, 1);
    assert.deepEqual(
        result.failureCategories,
        failureCategories({ provider_rejected_retryable: 1 }),
    );
    assert.deepEqual(failure, {
        claimId: 'claim-1',
        emailMessageId: 42,
        failureCode: 'provider_rejected_retryable',
        failureKind: 'definite',
        now,
    });
});

test('order confirmation worker fences an uncertain provider submission', async (t) => {
    t.mock.method(console, 'info', () => undefined);
    const privateSentinel = 'PRIVATE_PROVIDER_SENTINEL';
    let claimCount = 0;

    const result = await runOrderConfirmationEmailWorker({
        reconciliationLimit: 0,
        dependencies: {
            claim: async () => {
                claimCount += 1;
                return claimCount === 1 ? claim() : { status: 'empty' };
            },
            markFailed: async ({ failureCode, failureKind }) => {
                assert.equal(failureCode, 'provider_submission_uncertain');
                assert.equal(failureKind, 'uncertain');
                return { status: 'fenced' };
            },
            now: () => now,
            send: async (_to, _config, options) => {
                if (!options) throw new Error('Expected send options.');
                await options.beforeProviderSubmission?.();
                throw new EmailProviderSubmissionUncertainError(
                    operationId,
                    new Error(privateSentinel),
                );
            },
            start: async () => ({ operationId, status: 'started' }),
        },
    });

    assert.equal(result.uncertain, 1);
    assert.deepEqual(
        result.failureCategories,
        failureCategories({ provider_submission_uncertain: 1 }),
    );
    assert.equal(JSON.stringify(result).includes(privateSentinel), false);
});

test('order confirmation worker safely retries missing provider configuration', async (t) => {
    t.mock.method(console, 'info', () => undefined);
    const previousConnectionString = process.env.ACS_CONNECTION_STRING;
    t.after(() => {
        if (previousConnectionString === undefined) {
            delete process.env.ACS_CONNECTION_STRING;
        } else {
            process.env.ACS_CONNECTION_STRING = previousConnectionString;
        }
    });
    delete process.env.ACS_CONNECTION_STRING;
    let claimCount = 0;
    let failureCode: string | undefined;

    const result = await runOrderConfirmationEmailWorker({
        reconciliationLimit: 0,
        dependencies: {
            claim: async () => {
                claimCount += 1;
                return claimCount === 1 ? claim() : { status: 'empty' };
            },
            markFailed: async (input) => {
                failureCode = input.failureCode;
                return {
                    attempt: 1,
                    nextAttemptAt: new Date(now.getTime() + 60_000),
                    status: 'retry_scheduled',
                };
            },
            now: () => now,
            send: async () => {
                throw new Error('ACS_CONNECTION_STRING is not set');
            },
        },
    });

    assert.equal(failureCode, 'configuration_error');
    assert.equal(result.queuedForRetry, 1);
    assert.deepEqual(
        result.failureCategories,
        failureCategories({ configuration_error: 1 }),
    );
});

test('order confirmation worker bounds claim failures without leaking errors', async (t) => {
    const privateSentinel = 'PRIVATE_CLAIM_SENTINEL';
    const logged: unknown[] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => logged.push(args));
    t.mock.method(console, 'info', () => undefined);

    const result = await runOrderConfirmationEmailWorker({
        reconciliationLimit: 0,
        dependencies: {
            claim: async () => {
                throw new Error(privateSentinel);
            },
        },
    });

    assert.equal(result.claimFailures, 1);
    assert.equal(JSON.stringify(logged).includes(privateSentinel), false);
});

test('order confirmation worker stops before claiming work without a safe provider budget', async (t) => {
    t.mock.method(console, 'info', () => undefined);
    let monotonicReads = 0;
    let claims = 0;

    const result = await runOrderConfirmationEmailWorker({
        reconciliationLimit: 0,
        dependencies: {
            claim: async () => {
                claims += 1;
                return { status: 'empty' };
            },
            monotonicNow: () => {
                monotonicReads += 1;
                return monotonicReads === 1 ? 0 : 50_000;
            },
        },
    });

    assert.equal(claims, 0);
    assert.equal(result.stoppedForTimeBudget, true);
    assert.equal(result.durationMs, 50_000);
});

test('order confirmation worker reconciles a fenced provider operation with status GET only', async (t) => {
    t.mock.method(console, 'info', () => undefined);
    let reconciliationClaims = 0;
    let freshClaims = 0;
    let finalizedOutcome: unknown;

    const result = await runOrderConfirmationEmailWorker({
        dependencies: {
            claim: async () => {
                freshClaims += 1;
                return { status: 'empty' };
            },
            claimReconciliation: async () => {
                reconciliationClaims += 1;
                return reconciliationClaims === 1
                    ? {
                          claim: {
                              attempt: 1,
                              claimId: 'reconciliation-claim',
                              emailMessageId: 42,
                              operationId,
                          },
                          status: 'claimed',
                      }
                    : { status: 'empty' };
            },
            finalizeReconciliation: async (input) => {
                finalizedOutcome = input.outcome;
                return { status: 'sent' };
            },
            getOperationStatus: async () => 'Succeeded',
            now: () => now,
            randomId: () => 'reconciliation-claim',
        },
        reconciliationLimit: 2,
    });

    assert.equal(freshClaims, 1);
    assert.deepEqual(finalizedOutcome, {
        kind: 'provider_status',
        status: 'Succeeded',
    });
    assert.equal(result.reconciliation.claimed, 1);
    assert.equal(result.reconciliation.sent, 1);
    assert.equal(result.reconciliation.lookupFailures, 0);
});

test('order confirmation worker keeps unavailable provider status fenced without private errors', async (t) => {
    t.mock.method(console, 'info', () => undefined);
    const privateSentinel = 'PRIVATE_RECONCILIATION_LOOKUP_SENTINEL';
    const logged: unknown[] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => logged.push(args));
    let reconciliationClaims = 0;
    let finalizedOutcome: unknown;

    const result = await runOrderConfirmationEmailWorker({
        dependencies: {
            claim: async () => ({ status: 'empty' }),
            claimReconciliation: async () => {
                reconciliationClaims += 1;
                return reconciliationClaims === 1
                    ? {
                          claim: {
                              attempt: 2,
                              claimId: 'reconciliation-claim',
                              emailMessageId: 42,
                              operationId,
                          },
                          status: 'claimed',
                      }
                    : { status: 'empty' };
            },
            finalizeReconciliation: async (input) => {
                finalizedOutcome = input.outcome;
                return {
                    attempt: 2,
                    nextCheckAt: new Date(now.getTime() + 60_000),
                    status: 'pending',
                };
            },
            getOperationStatus: async () => {
                throw new Error(privateSentinel);
            },
            now: () => now,
            randomId: () => 'reconciliation-claim',
        },
        reconciliationLimit: 2,
    });

    assert.deepEqual(finalizedOutcome, { kind: 'lookup_unavailable' });
    assert.equal(result.reconciliation.lookupFailures, 1);
    assert.equal(result.reconciliation.pending, 1);
    assert.equal(JSON.stringify(logged).includes(privateSentinel), false);
});
