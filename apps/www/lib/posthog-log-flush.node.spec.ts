import assert from 'node:assert/strict';
import test from 'node:test';

import { createPostHogLogFlushScheduler } from './posthog-log-flush.ts';

test('coalesces log flushes during the batch window', async () => {
    let flushCount = 0;
    let releaseBatchWindow = () => {};
    const batchWindow = new Promise<void>((resolve) => {
        releaseBatchWindow = resolve;
    });
    const scheduleFlush = createPostHogLogFlushScheduler({
        batchDelayMs: 1_000,
        failureCooldownMs: 30_000,
        flush: async () => {
            flushCount += 1;
        },
        onError: () => {},
        wait: () => batchWindow,
    });

    const firstFlush = scheduleFlush();
    const secondFlush = scheduleFlush();

    assert.equal(firstFlush, secondFlush);
    assert.equal(flushCount, 0);

    releaseBatchWindow();
    await firstFlush;

    assert.equal(flushCount, 1);
});

test('allows a new flush after the previous batch completes', async () => {
    let flushCount = 0;
    const scheduleFlush = createPostHogLogFlushScheduler({
        batchDelayMs: 1_000,
        failureCooldownMs: 30_000,
        flush: async () => {
            flushCount += 1;
        },
        onError: () => {},
        wait: async () => {},
    });

    await scheduleFlush();
    await scheduleFlush();

    assert.equal(flushCount, 2);
});

test('backs off force flushes after a failure', async () => {
    const flushError = new Error('Operation timed out');
    const reportedErrors: unknown[] = [];
    let currentTime = 1_000;
    let flushCount = 0;
    const scheduleFlush = createPostHogLogFlushScheduler({
        batchDelayMs: 1_000,
        failureCooldownMs: 30_000,
        flush: async () => {
            flushCount += 1;
            if (flushCount === 1) {
                throw flushError;
            }
        },
        now: () => currentTime,
        onError: (error) => {
            reportedErrors.push(error);
        },
        wait: async () => {},
    });

    await scheduleFlush();
    await scheduleFlush();

    assert.equal(flushCount, 1);
    assert.deepEqual(reportedErrors, [flushError]);

    currentTime += 30_000;
    await scheduleFlush();

    assert.equal(flushCount, 2);
});
