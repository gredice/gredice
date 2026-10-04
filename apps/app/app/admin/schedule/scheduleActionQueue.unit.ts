import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createScheduleActionQueue,
    fieldScheduleTaskVersionChange,
    resolveScheduleFormVersion,
    scheduleTaskVersionChange,
    settleScheduleActions,
} from './scheduleActionQueue';

function deferred() {
    return Promise.withResolvers<void>();
}

test('terminal planting updates hand off the closed cycle version', () => {
    assert.deepEqual(
        fieldScheduleTaskVersionChange(
            {
                id: 1,
                plantCycles: [
                    { active: false, plantPlaceEventId: 10, endedEventId: 12 },
                ],
            },
            10,
            11,
        ),
        scheduleTaskVersionChange('field:1', 11, 12),
    );
});

test('field version handoff targets the submitted cycle even when another exists', () => {
    assert.deepEqual(
        fieldScheduleTaskVersionChange(
            {
                id: 1,
                plantCycles: [
                    { active: false, plantPlaceEventId: 10, endedEventId: 12 },
                    { active: true, plantPlaceEventId: 20, endedEventId: 21 },
                ],
            },
            10,
            11,
        ),
        scheduleTaskVersionChange('field:1', 11, 12),
    );
});

test('field version handoff refuses a missing task cycle', () => {
    assert.throws(
        () =>
            fieldScheduleTaskVersionChange(
                {
                    id: 1,
                    plantCycles: [
                        {
                            active: true,
                            plantPlaceEventId: 20,
                            endedEventId: 21,
                        },
                    ],
                },
                10,
                11,
            ),
        /Trenutna verzija/,
    );
});

test('overlapping single and bulk requests preserve submission order', async () => {
    const queue = createScheduleActionQueue();
    const first = deferred();
    const other = deferred();
    const order: string[] = [];
    const one = queue.run(['operation:1'], async () => {
        order.push('one');
        await first.promise;
    });
    const two = queue.run(['operation:2'], async () => {
        order.push('two');
        await other.promise;
    });
    const bulk = queue.run(['operation:1', 'operation:2'], async () => {
        order.push('bulk');
    });
    const last = queue.run(['operation:1'], async () => {
        order.push('last');
    });
    await Promise.resolve();
    assert.deepEqual(order, ['one', 'two']);
    first.resolve();
    await one;
    assert.deepEqual(order, ['one', 'two']);
    other.resolve();
    await Promise.all([two, bulk, last]);
    assert.deepEqual(order, ['one', 'two', 'bulk', 'last']);
});

test('rejected and recoverable failures release targets for retry', async () => {
    const queue = createScheduleActionQueue();
    const failed = queue.run(['field:1', 'field:1'], async () => {
        throw new Error('Failed');
    });
    const conflict = queue.run(['field:1'], async () => ({ success: false }));
    const retry = queue.run(['field:1'], async () => 'retried');
    await assert.rejects(failed, /Failed/);
    assert.deepEqual(await conflict, { success: false });
    assert.equal(await retry, 'retried');
});

test('version handoff follows only this schedule changes across queued requests', async () => {
    const queue = createScheduleActionQueue();
    const first = queue.run(['operation:1'], async (version) => {
        assert.equal(version('operation:1', 10), 10);
        return scheduleTaskVersionChange('operation:1', 10, 11);
    });
    const second = queue.run(['operation:1'], async (version) => {
        assert.equal(version('operation:1', 10), 11);
        return scheduleTaskVersionChange('operation:1', 11, 12);
    });
    await Promise.all([first, second]);
    await queue.run(['operation:1'], async (version) => {
        assert.equal(version('operation:1', 10), 12);
        assert.equal(version('operation:1', 11), 12);
        // A version from another editor is never overwritten by our lineage.
        assert.equal(version('operation:1', 20), 20);
        assert.equal(version('field:1', 10), 10);
    });
});

test('bulk failure waits for every target and retains successful version changes', async () => {
    const queue = createScheduleActionQueue();
    const slow = deferred();
    const failure = new Error('Failed');
    let nextStarted = false;
    const bulk = queue.run(['operation:1', 'operation:2'], () =>
        settleScheduleActions([
            Promise.reject(failure),
            slow.promise.then(() =>
                scheduleTaskVersionChange('operation:2', 10, 11),
            ),
        ]),
    );
    const next = queue.run(['operation:2'], async (version) => {
        nextStarted = true;
        assert.equal(version('operation:2', 10), 11);
    });
    await Promise.resolve();
    assert.equal(nextStarted, false);
    slow.resolve();
    const result = await bulk;
    assert.deepEqual(result[0], { success: false, message: 'Failed' });
    await next;
    assert.equal(nextStarted, true);
});

test('form version handoff preserves repeated values and the original input', () => {
    const form = new FormData();
    form.set('expectedTaskVersionEventId', '10');
    form.append('user', 'one');
    form.append('user', 'two');
    const updated = resolveScheduleFormVersion(
        form,
        'operation:1',
        'expectedTaskVersionEventId',
        () => 11,
    );
    assert.equal(updated.get('expectedTaskVersionEventId'), '11');
    assert.deepEqual(updated.getAll('user'), ['one', 'two']);
    assert.equal(form.get('expectedTaskVersionEventId'), '10');
});
