import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type PackedPlantWorkerExecutionResult,
    runPackedPlantWorkerWithRetry,
} from './packedPlantWorkerRetry';

class TestRuntimeError extends Error {}

function isRuntimeError(error: unknown) {
    return error instanceof TestRuntimeError;
}

test('profiles both worker attempts and the failed-attempt cost before retry success', async () => {
    const allowSyncFallbackValues: boolean[] = [];
    const failedDurations: number[] = [];
    let attemptCount = 0;
    let startedAttemptCount = 0;
    const clockValues = [10, 17, 20, 26];

    const result = await runPackedPlantWorkerWithRetry({
        execute: async ({
            allowSyncFallback,
            onWorkerAttemptStarted,
        }): Promise<PackedPlantWorkerExecutionResult<string>> => {
            allowSyncFallbackValues.push(allowSyncFallback);
            attemptCount += 1;
            onWorkerAttemptStarted();
            if (attemptCount === 1) {
                throw new TestRuntimeError('restart worker');
            }
            return {
                executionKind: 'worker',
                response: 'ready',
            };
        },
        isRuntimeError,
        now: () => clockValues.shift() ?? 20,
        onWorkerAttemptFailed: (durationMs) => {
            failedDurations.push(durationMs);
        },
        onWorkerAttemptStarted: () => {
            startedAttemptCount += 1;
        },
    });

    assert.deepEqual(result, {
        executionKind: 'worker',
        response: 'ready',
        workerDurationMs: 6,
    });
    assert.deepEqual(allowSyncFallbackValues, [true, false]);
    assert.equal(startedAttemptCount, 2);
    assert.deepEqual(failedDurations, [7]);
});

test('does not profile constructor-unavailable synchronous fallback as worker work', async () => {
    let startedAttemptCount = 0;
    const failedDurations: number[] = [];

    const result = await runPackedPlantWorkerWithRetry({
        execute: async ({ allowSyncFallback }) => {
            assert.equal(allowSyncFallback, true);
            return {
                executionKind: 'sync-fallback' as const,
                response: 'main-thread-result',
            };
        },
        isRuntimeError,
        now: () => {
            throw new Error('sync fallback must not read the worker clock');
        },
        onWorkerAttemptFailed: (durationMs) => {
            failedDurations.push(durationMs);
        },
        onWorkerAttemptStarted: () => {
            startedAttemptCount += 1;
        },
    });

    assert.deepEqual(result, {
        executionKind: 'sync-fallback',
        response: 'main-thread-result',
        workerDurationMs: null,
    });
    assert.equal(startedAttemptCount, 0);
    assert.deepEqual(failedDurations, []);
});

test('records each attempted failure when both runtime attempts fail', async () => {
    const failedDurations: number[] = [];
    let startedAttemptCount = 0;
    const clockValues = [2, 5, 10, 16];

    await assert.rejects(
        runPackedPlantWorkerWithRetry({
            execute: async ({ onWorkerAttemptStarted }) => {
                onWorkerAttemptStarted();
                throw new TestRuntimeError('worker failed');
            },
            isRuntimeError,
            now: () => clockValues.shift() ?? 16,
            onWorkerAttemptFailed: (durationMs) => {
                failedDurations.push(durationMs);
            },
            onWorkerAttemptStarted: () => {
                startedAttemptCount += 1;
            },
        }),
        TestRuntimeError,
    );

    assert.equal(startedAttemptCount, 2);
    assert.deepEqual(failedDurations, [3, 6]);
});

test('does not count an unavailable retry as a worker attempt', async () => {
    const failedDurations: number[] = [];
    let attemptCount = 0;
    let startedAttemptCount = 0;
    const clockValues = [4, 9];

    await assert.rejects(
        runPackedPlantWorkerWithRetry({
            execute: async ({ allowSyncFallback, onWorkerAttemptStarted }) => {
                attemptCount += 1;
                if (attemptCount === 1) {
                    assert.equal(allowSyncFallback, true);
                    onWorkerAttemptStarted();
                    throw new TestRuntimeError('worker crashed');
                }

                assert.equal(allowSyncFallback, false);
                throw new TestRuntimeError('worker unavailable after restart');
            },
            isRuntimeError,
            now: () => clockValues.shift() ?? 9,
            onWorkerAttemptFailed: (durationMs) => {
                failedDurations.push(durationMs);
            },
            onWorkerAttemptStarted: () => {
                startedAttemptCount += 1;
            },
        }),
        TestRuntimeError,
    );

    assert.equal(startedAttemptCount, 1);
    assert.deepEqual(failedDurations, [5]);
});
