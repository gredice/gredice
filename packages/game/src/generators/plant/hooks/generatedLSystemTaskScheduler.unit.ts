import assert from 'node:assert/strict';
import test from 'node:test';
import { GeneratedLSystemTaskScheduler } from './generatedLSystemTaskScheduler';

interface Deferred<Value> {
    promise: Promise<Value>;
    reject: (reason?: unknown) => void;
    resolve: (value: Value | PromiseLike<Value>) => void;
}

function createDeferred<Value>(): Deferred<Value> {
    let reject: Deferred<Value>['reject'] = () => {};
    let resolve: Deferred<Value>['resolve'] = () => {};
    const promise = new Promise<Value>((promiseResolve, promiseReject) => {
        reject = promiseReject;
        resolve = promiseResolve;
    });

    return { promise, reject, resolve };
}

async function flushSchedulerMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

test('runs one atomic task at a time by priority and FIFO order', async () => {
    const executionOrder: string[] = [];
    const deferredByTask = new Map(
        ['background', 'normal', 'focused'].map((task) => [
            task,
            createDeferred<string>(),
        ]),
    );
    const scheduler = new GeneratedLSystemTaskScheduler((task: string) => {
        executionOrder.push(task);
        const deferred = deferredByTask.get(task);
        assert.ok(deferred);
        return deferred.promise;
    });

    const background = scheduler.schedule({
        key: 'background',
        priority: 'background',
        task: 'background',
    });
    const normal = scheduler.schedule({
        key: 'normal',
        task: 'normal',
    });
    const focused = scheduler.schedule({
        key: 'focused',
        priority: 'focused',
        task: 'focused',
    });

    await flushSchedulerMicrotasks();
    assert.deepEqual(executionOrder, ['focused']);
    assert.deepEqual(scheduler.snapshot(), {
        activeSubscriberCount: 3,
        cancelledSubscriberCount: 0,
        completedTaskCount: 0,
        deduplicatedSubscriberCount: 0,
        deliveredSubscriberCount: 0,
        enqueuedTaskCount: 3,
        failedTaskCount: 0,
        focusedPromotionCount: 0,
        focusedQueuedTaskCount: 0,
        inFlightTaskKey: 'focused',
        peakQueuedTaskCount: 3,
        priorityPromotionCount: 0,
        queuedTaskCount: 2,
        queuedTaskRemovalCount: 0,
        staleResultCount: 0,
        startedTaskCount: 1,
        submittedSubscriberCount: 3,
    });

    deferredByTask.get('focused')?.resolve('focused-result');
    assert.equal(await focused, 'focused-result');
    await flushSchedulerMicrotasks();
    assert.deepEqual(executionOrder, ['focused', 'normal']);

    deferredByTask.get('normal')?.resolve('normal-result');
    assert.equal(await normal, 'normal-result');
    await flushSchedulerMicrotasks();
    assert.deepEqual(executionOrder, ['focused', 'normal', 'background']);

    deferredByTask.get('background')?.resolve('background-result');
    assert.equal(await background, 'background-result');
    await flushSchedulerMicrotasks();

    const completed = scheduler.snapshot();
    assert.equal(completed.inFlightTaskKey, null);
    assert.equal(completed.queuedTaskCount, 0);
    assert.equal(completed.startedTaskCount, 3);
    assert.equal(completed.completedTaskCount, 3);
    assert.equal(completed.deliveredSubscriberCount, 3);
});

test('deduplicates keyed work and lets one subscriber abort independently', async () => {
    const deferred = createDeferred<string>();
    const abortController = new AbortController();
    const executionPriorities: string[] = [];
    let executionCount = 0;
    const scheduler = new GeneratedLSystemTaskScheduler(
        (_task: string, context: { priority: string }): Promise<string> => {
            executionCount += 1;
            executionPriorities.push(context.priority);
            return deferred.promise;
        },
    );

    const cancelled = scheduler.schedule({
        key: 'shared',
        priority: 'normal',
        signal: abortController.signal,
        task: 'first-payload-wins',
    });
    const retained = scheduler.schedule({
        key: 'shared',
        priority: 'focused',
        task: 'deduplicated-payload',
    });

    await flushSchedulerMicrotasks();
    assert.equal(executionCount, 1);
    assert.deepEqual(executionPriorities, ['focused']);

    const cancellation = assert.rejects(cancelled, { name: 'AbortError' });
    abortController.abort();
    await cancellation;

    deferred.resolve('shared-result');
    assert.equal(await retained, 'shared-result');
    await flushSchedulerMicrotasks();

    const snapshot = scheduler.snapshot();
    assert.equal(snapshot.submittedSubscriberCount, 2);
    assert.equal(snapshot.enqueuedTaskCount, 1);
    assert.equal(snapshot.deduplicatedSubscriberCount, 1);
    assert.equal(snapshot.priorityPromotionCount, 1);
    assert.equal(snapshot.focusedPromotionCount, 1);
    assert.equal(snapshot.cancelledSubscriberCount, 1);
    assert.equal(snapshot.deliveredSubscriberCount, 1);
    assert.equal(snapshot.staleResultCount, 0);
});

test('promotes queued focused work ahead of normal work', async () => {
    const executionOrder: string[] = [];
    const deferredByTask = new Map(
        ['blocker', 'normal', 'promoted'].map((task) => [
            task,
            createDeferred<string>(),
        ]),
    );
    const scheduler = new GeneratedLSystemTaskScheduler((task: string) => {
        executionOrder.push(task);
        const deferred = deferredByTask.get(task);
        assert.ok(deferred);
        return deferred.promise;
    });

    const blocker = scheduler.schedule({
        key: 'blocker',
        priority: 'focused',
        task: 'blocker',
    });
    await flushSchedulerMicrotasks();

    const normal = scheduler.schedule({
        key: 'normal',
        task: 'normal',
    });
    const promoted = scheduler.schedule({
        key: 'promoted',
        priority: 'background',
        task: 'promoted',
    });
    assert.equal(scheduler.promote('promoted'), true);
    assert.equal(scheduler.promote('promoted'), false);

    deferredByTask.get('blocker')?.resolve('blocker-result');
    assert.equal(await blocker, 'blocker-result');
    await flushSchedulerMicrotasks();
    assert.deepEqual(executionOrder, ['blocker', 'promoted']);

    deferredByTask.get('promoted')?.resolve('promoted-result');
    assert.equal(await promoted, 'promoted-result');
    await flushSchedulerMicrotasks();
    assert.deepEqual(executionOrder, ['blocker', 'promoted', 'normal']);

    deferredByTask.get('normal')?.resolve('normal-result');
    assert.equal(await normal, 'normal-result');

    const snapshot = scheduler.snapshot();
    assert.equal(snapshot.priorityPromotionCount, 1);
    assert.equal(snapshot.focusedPromotionCount, 1);
});

test('removes queued tasks after their last subscriber aborts', async () => {
    const blockerDeferred = createDeferred<string>();
    const abortController = new AbortController();
    const executionOrder: string[] = [];
    const scheduler = new GeneratedLSystemTaskScheduler((task: string) => {
        executionOrder.push(task);
        if (task === 'blocker') {
            return blockerDeferred.promise;
        }
        return `${task}-result`;
    });

    const blocker = scheduler.schedule({
        key: 'blocker',
        task: 'blocker',
    });
    await flushSchedulerMicrotasks();
    const cancelled = scheduler.schedule({
        key: 'cancelled',
        signal: abortController.signal,
        task: 'cancelled',
    });
    const cancellation = assert.rejects(cancelled, { name: 'AbortError' });
    abortController.abort();
    await cancellation;

    assert.equal(scheduler.snapshot().queuedTaskCount, 0);
    assert.equal(scheduler.snapshot().queuedTaskRemovalCount, 1);

    blockerDeferred.resolve('blocker-result');
    assert.equal(await blocker, 'blocker-result');
    await flushSchedulerMicrotasks();

    assert.deepEqual(executionOrder, ['blocker']);
    assert.equal(scheduler.snapshot().startedTaskCount, 1);
});

test('suppresses stale in-flight results and continues with fresh work', async () => {
    const staleDeferred = createDeferred<string>();
    const freshDeferred = createDeferred<string>();
    const abortController = new AbortController();
    const executionOrder: string[] = [];
    const scheduler = new GeneratedLSystemTaskScheduler((task: string) => {
        executionOrder.push(task);
        return task === 'stale' ? staleDeferred.promise : freshDeferred.promise;
    });

    const stale = scheduler.schedule({
        key: 'stale',
        signal: abortController.signal,
        task: 'stale',
    });
    await flushSchedulerMicrotasks();
    const cancellation = assert.rejects(stale, { name: 'AbortError' });
    abortController.abort();
    await cancellation;

    const fresh = scheduler.schedule({
        key: 'fresh',
        priority: 'focused',
        task: 'fresh',
    });
    staleDeferred.resolve('must-not-deliver');
    await flushSchedulerMicrotasks();
    assert.deepEqual(executionOrder, ['stale', 'fresh']);

    freshDeferred.resolve('fresh-result');
    assert.equal(await fresh, 'fresh-result');
    await flushSchedulerMicrotasks();

    const snapshot = scheduler.snapshot();
    assert.equal(snapshot.cancelledSubscriberCount, 1);
    assert.equal(snapshot.staleResultCount, 1);
    assert.equal(snapshot.completedTaskCount, 2);
    assert.equal(snapshot.deliveredSubscriberCount, 1);
    assert.equal(snapshot.inFlightTaskKey, null);
});
