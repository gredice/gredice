import assert from 'node:assert/strict';
import test from 'node:test';
import { runTasksWithConcurrency } from './runTasksWithConcurrency.ts';

test('runs tasks concurrently while preserving input order', async () => {
    let activeTaskCount = 0;
    let maximumActiveTaskCount = 0;

    const results = await runTasksWithConcurrency(
        [30, 5, 20, 1, 10, 2],
        3,
        async (delay, index) => {
            activeTaskCount += 1;
            maximumActiveTaskCount = Math.max(
                maximumActiveTaskCount,
                activeTaskCount,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            activeTaskCount -= 1;
            return `result-${index}`;
        },
    );

    assert.equal(maximumActiveTaskCount, 3);
    assert.deepEqual(results, [
        'result-0',
        'result-1',
        'result-2',
        'result-3',
        'result-4',
        'result-5',
    ]);
});

test('uses one worker when the requested concurrency is invalid', async () => {
    let activeTaskCount = 0;
    let maximumActiveTaskCount = 0;

    await runTasksWithConcurrency([1, 2, 3], 0, async () => {
        activeTaskCount += 1;
        maximumActiveTaskCount = Math.max(
            maximumActiveTaskCount,
            activeTaskCount,
        );
        await Promise.resolve();
        activeTaskCount -= 1;
    });

    assert.equal(maximumActiveTaskCount, 1);
});
