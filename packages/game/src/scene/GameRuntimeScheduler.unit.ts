import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    GameRuntimeScheduler,
    type GameRuntimeSchedulerOptions,
    type GameRuntimeSchedulerSnapshot,
} from './GameRuntimeScheduler';

const timingToleranceMs = 0.01;

type FakeTask = {
    callback: (timestamp?: number) => void;
    callbackDelayMs: number;
    dueAt: number;
    frameTimestamp?: number;
    id: number;
    kind: 'frame' | 'timeout';
    source: 'renderer-frame' | 'scheduler-frame' | 'timeout';
};

class FakeRuntimeQueue {
    browserLongTimeoutDelays = false;
    currentTime = 0;
    maximumPendingTaskCount = 0;
    readonly scheduledKinds: FakeTask['kind'][] = [];
    readonly tasks = new Map<number, FakeTask>();
    readonly taskHistory: FakeTask[] = [];
    private displayFrameIntervalIndex = 0;
    private nextTaskId = 1;
    private variableDisplayFrameCursor = 1;
    private readonly variableDisplayFramesAt = [0];

    constructor(
        public displayFramesPerSecond = 60,
        private readonly frameStepCounts: number[] = [],
        private readonly frameCallbackDelaysMs: number[] = [],
        private readonly displayFrameIntervalsMs: readonly number[] = [],
    ) {}

    readonly now = () => this.currentTime;

    readonly setTimeout = (callback: () => void, delayMs: number) => {
        const scheduledDelayMs = this.browserLongTimeoutDelays
            ? Math.trunc(delayMs)
            : delayMs;
        return this.schedule(
            'timeout',
            'timeout',
            callback,
            this.currentTime + scheduledDelayMs,
        );
    };

    readonly requestFrame = (callback: (timestamp?: number) => void) =>
        this.scheduleFrame(callback, true);

    readonly requestSchedulerFrame = (callback: (timestamp?: number) => void) =>
        this.scheduleFrame(callback, false);

    private scheduleFrame(
        callback: (timestamp?: number) => void,
        simulateRendererWork: boolean,
    ) {
        const frameIntervalMs = 1000 / this.displayFramesPerSecond;
        const frameStepCount = Math.max(
            1,
            Math.floor(
                (simulateRendererWork ? this.frameStepCounts.shift() : 1) ?? 1,
            ),
        );
        let frameTimestamp: number;
        if (this.displayFrameIntervalsMs.length > 0) {
            frameTimestamp = this.getVariableDisplayFrameAt(
                frameStepCount,
                frameIntervalMs,
            );
        } else {
            const currentFrameNumber = Math.floor(
                this.currentTime / frameIntervalMs + timingToleranceMs,
            );
            frameTimestamp =
                (currentFrameNumber + frameStepCount) * frameIntervalMs;
        }
        const callbackDelayMs = Math.max(
            0,
            (simulateRendererWork
                ? this.frameCallbackDelaysMs.shift()
                : undefined) ?? 0,
        );
        return this.schedule(
            'frame',
            simulateRendererWork ? 'renderer-frame' : 'scheduler-frame',
            callback,
            frameTimestamp,
            frameTimestamp,
            callbackDelayMs,
        );
    }

    readonly clearTimeout = (handle: unknown) => {
        this.tasks.delete(Number(handle));
    };

    get pendingTaskCount() {
        return this.tasks.size;
    }

    peekNextTask() {
        return [...this.tasks.values()].sort(
            (left, right) => left.dueAt - right.dueAt || left.id - right.id,
        )[0];
    }

    runNext(atTime?: number) {
        const task = this.peekNextTask();
        assert.ok(task, 'Expected a scheduled callback');
        return this.runTask(task, atTime);
    }

    runTask(task: FakeTask, atTime?: number) {
        this.tasks.delete(task.id);
        this.currentTime =
            Math.max(this.currentTime, atTime ?? task.dueAt) +
            task.callbackDelayMs;
        task.callback(task.frameTimestamp);
        return task;
    }

    runUntil(targetTime: number, maximumCallbacks = 20_000) {
        let callbacks = 0;
        while ((this.peekNextTask()?.dueAt ?? Infinity) <= targetTime) {
            assert.ok(
                callbacks++ < maximumCallbacks,
                'Scheduler exceeded the deterministic callback limit',
            );
            this.runNext();
        }
        this.currentTime = Math.max(this.currentTime, targetTime);
    }

    invokeStale(task: FakeTask, atTime = task.dueAt) {
        this.currentTime = Math.max(this.currentTime, atTime);
        task.callback();
    }

    private getVariableDisplayFrameAt(
        frameStepCount: number,
        fallbackIntervalMs: number,
    ) {
        this.ensureVariableDisplayFrame(
            this.variableDisplayFrameCursor,
            fallbackIntervalMs,
        );
        while (
            (this.variableDisplayFramesAt[this.variableDisplayFrameCursor] ??
                Infinity) <=
            this.currentTime + timingToleranceMs
        ) {
            this.variableDisplayFrameCursor += 1;
            this.ensureVariableDisplayFrame(
                this.variableDisplayFrameCursor,
                fallbackIntervalMs,
            );
        }
        const requestedFrameIndex =
            this.variableDisplayFrameCursor + frameStepCount - 1;
        this.ensureVariableDisplayFrame(
            requestedFrameIndex,
            fallbackIntervalMs,
        );
        return this.variableDisplayFramesAt[requestedFrameIndex] ?? 0;
    }

    private ensureVariableDisplayFrame(
        frameIndex: number,
        fallbackIntervalMs: number,
    ) {
        while (this.variableDisplayFramesAt.length <= frameIndex) {
            this.advanceVariableDisplayFrame(fallbackIntervalMs);
        }
    }

    private advanceVariableDisplayFrame(fallbackIntervalMs: number) {
        const candidate =
            this.displayFrameIntervalsMs[
                this.displayFrameIntervalIndex %
                    this.displayFrameIntervalsMs.length
            ];
        this.displayFrameIntervalIndex += 1;
        const intervalMs =
            candidate !== undefined &&
            Number.isFinite(candidate) &&
            candidate > 0
                ? candidate
                : fallbackIntervalMs;
        const previousFrameAt = this.variableDisplayFramesAt.at(-1) ?? 0;
        this.variableDisplayFramesAt.push(previousFrameAt + intervalMs);
    }

    private schedule(
        kind: FakeTask['kind'],
        source: FakeTask['source'],
        callback: (timestamp?: number) => void,
        dueAt: number,
        frameTimestamp?: number,
        callbackDelayMs = 0,
    ) {
        const task: FakeTask = {
            callback,
            callbackDelayMs,
            dueAt,
            frameTimestamp,
            id: this.nextTaskId++,
            kind,
            source,
        };
        this.tasks.set(task.id, task);
        this.taskHistory.push(task);
        this.scheduledKinds.push(kind);
        this.maximumPendingTaskCount = Math.max(
            this.maximumPendingTaskCount,
            this.tasks.size,
        );
        return task.id;
    }
}

function createScheduler({
    frameCallbackTimes = [],
    invalidations = [],
    options,
    queue = new FakeRuntimeQueue(),
    simulateFrameCallbacks = false,
    snapshots,
}: {
    frameCallbackTimes?: number[];
    invalidations?: number[];
    options?: Partial<GameRuntimeSchedulerOptions>;
    queue?: FakeRuntimeQueue;
    simulateFrameCallbacks?: boolean;
    snapshots?: GameRuntimeSchedulerSnapshot[];
} = {}) {
    const invalidate =
        options?.invalidate ?? (() => invalidations.push(queue.currentTime));
    let framePending = false;
    let frameHandle: unknown = null;
    let scheduler: GameRuntimeScheduler;
    const requestExternalFrame = () => {
        if (!simulateFrameCallbacks || framePending) {
            return;
        }
        framePending = true;
        frameHandle = queue.requestFrame((displayTimestamp) => {
            framePending = false;
            frameHandle = null;
            frameCallbackTimes.push(displayTimestamp ?? queue.currentTime);
            scheduler.recordFrameCallback(displayTimestamp);
        });
    };
    const recordExternalFrame = (displayTimestamp = queue.currentTime) => {
        if (framePending) {
            queue.clearTimeout(frameHandle);
            framePending = false;
            frameHandle = null;
        }
        frameCallbackTimes.push(displayTimestamp);
        scheduler.recordFrameCallback(displayTimestamp);
    };
    scheduler = new GameRuntimeScheduler({
        cancelFrame: queue.clearTimeout,
        clearTimeout: queue.clearTimeout,
        initialVisibility: {
            canvasVisible: true,
            contextAvailable: true,
            documentVisible: true,
            requireCanvasVisible: true,
        },
        now: queue.now,
        onSnapshot: snapshots
            ? (snapshot) => snapshots.push(snapshot)
            : undefined,
        requestFrame: queue.requestSchedulerFrame,
        setTimeout: queue.setTimeout,
        ...options,
        invalidate: () => {
            invalidate();
            requestExternalFrame();
        },
    });
    return {
        frameCallbackTimes,
        invalidations,
        queue,
        recordExternalFrame,
        requestExternalFrame,
        scheduler,
    };
}

function assertNear(actual: number, expected: number) {
    assert.ok(
        Math.abs(actual - expected) <= timingToleranceMs,
        `Expected ${actual} to be within ${timingToleranceMs}ms of ${expected}`,
    );
}

function assertWakeupClassificationConserved(
    snapshot: GameRuntimeSchedulerSnapshot,
) {
    assert.equal(
        snapshot.wakeupCount,
        snapshot.productiveWakeupCount +
            snapshot.retainedTimeoutReconciliationWakeupCount +
            snapshot.pendingFrameReceiptReconciliationWakeupCount +
            snapshot.unexpectedNoWorkWakeupCount,
    );
}

function holdNextOwnedFrameReceipt(
    queue: FakeRuntimeQueue,
    scheduler: GameRuntimeScheduler,
) {
    let callbackCount = 0;
    const invalidationCount = scheduler.getSnapshot().invalidationCount;
    while (scheduler.getSnapshot().invalidationCount === invalidationCount) {
        assert.ok(
            callbackCount++ < 20,
            'Expected an owned invalidation before holding its receipt',
        );
        queue.runNext();
    }
    const receipt = [...queue.tasks.values()].find(
        (task) => task.source === 'renderer-frame',
    );
    assert.ok(receipt, 'Expected an owned R3F frame receipt');
    queue.tasks.delete(receipt.id);
    assert.equal(scheduler.getSnapshot().awaitingFrameReceipt, true);
    return receipt;
}

function createDeterministicCallbackDelays(
    count: number,
    maximumDelayMs: number,
) {
    let state = 0x1a2b3c4d;
    return Array.from({ length: count }, () => {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        return (state / 0x1_0000_0000) * maximumDelayMs;
    });
}

describe('GameRuntimeScheduler idle and cadence', () => {
    it('is inert by default and performs zero idle work', () => {
        const queue = new FakeRuntimeQueue();
        const snapshots: GameRuntimeSchedulerSnapshot[] = [];
        const scheduler = new GameRuntimeScheduler({
            cancelFrame: queue.clearTimeout,
            clearTimeout: queue.clearTimeout,
            invalidate: () => assert.fail('idle scheduler invalidated'),
            now: queue.now,
            onSnapshot: (snapshot) => snapshots.push(snapshot),
            requestFrame: queue.requestSchedulerFrame,
            setTimeout: queue.setTimeout,
        });

        assert.equal(queue.pendingTaskCount, 0);
        assert.equal(scheduler.getSnapshot().effectiveVisible, false);
        let activations = 0;
        let resumes = 0;
        scheduler.subscribeActivation(() => {
            activations += 1;
        });
        scheduler.subscribeResume(() => {
            resumes += 1;
        });
        scheduler.setDocumentVisible(true);
        queue.runUntil(5_000);
        assert.equal(queue.pendingTaskCount, 0);
        assert.equal(scheduler.getSnapshot().wakeupCount, 0);
        assert.equal(scheduler.getSnapshot().resumeCount, 0);
        assert.equal(activations, 1);
        assert.equal(resumes, 0);

        scheduler.setDocumentVisible(false);
        scheduler.setDocumentVisible(true);
        assert.equal(scheduler.getSnapshot().resumeCount, 1);
        assert.equal(activations, 2);
        assert.equal(resumes, 1);
        assert.ok(snapshots.length >= 1);
    });

    for (const framesPerSecond of [20, 30, 60] as const) {
        it(`delivers a stable ${framesPerSecond} FPS invalidation cadence`, () => {
            const { frameCallbackTimes, invalidations, queue, scheduler } =
                createScheduler({ simulateFrameCallbacks: true });
            const release = scheduler.acquireRenderLease(
                'weather',
                framesPerSecond,
            );

            queue.runUntil(1_000);
            const steadyFrameCallbackTimes = frameCallbackTimes.filter(
                (timestamp) => timestamp >= 300,
            );
            assert.ok(steadyFrameCallbackTimes.length >= 4);
            steadyFrameCallbackTimes.forEach((time, index, sampledTimes) => {
                if (index === 0) {
                    return;
                }
                assertNear(
                    time - (sampledTimes[index - 1] ?? 0),
                    1000 / framesPerSecond,
                );
            });
            invalidations.forEach((time) => {
                assert.ok(time >= 0);
            });
            assert.ok(queue.maximumPendingTaskCount <= 2);

            assert.ok(
                queue.scheduledKinds.every(
                    (kind) => kind === 'frame' || kind === 'timeout',
                ),
            );
            assert.ok(
                scheduler.getSnapshot().wakeupCount >= invalidations.length,
            );

            release();
            queue.runUntil(1_050);
            assert.equal(queue.pendingTaskCount, 0);
        });
    }

    for (const { displayFramesPerSecond, targetFramesPerSecond } of [
        { displayFramesPerSecond: 144, targetFramesPerSecond: 30 },
        { displayFramesPerSecond: 120, targetFramesPerSecond: 60 },
    ] as const) {
        it(`sleeps at ${targetFramesPerSecond} FPS after bounded calibration on ${displayFramesPerSecond} Hz`, () => {
            const queue = new FakeRuntimeQueue(displayFramesPerSecond);
            const { frameCallbackTimes, scheduler } = createScheduler({
                queue,
                simulateFrameCallbacks: true,
            });
            const release = scheduler.acquireRenderLease(
                'semantic-sleep',
                targetFramesPerSecond,
            );

            queue.runUntil(1_000);
            const calibrationFrameCount = queue.taskHistory.filter(
                (task) => task.source === 'scheduler-frame',
            ).length;
            const start = scheduler.getSnapshot();
            assert.equal(start.displayFrameCalibrationCount, 1);
            assert.ok(
                calibrationFrameCount >= 8 && calibrationFrameCount <= 13,
            );
            assert.equal(start.pendingCallbackKind, 'timeout');
            assert.ok(start.pendingCallbackDueAt !== null);

            queue.runUntil(5_000);
            const end = scheduler.getSnapshot();
            const wakeupDelta = end.wakeupCount - start.wakeupCount;
            const invalidationDelta =
                end.invalidationCount - start.invalidationCount;
            const expectedWakeups = targetFramesPerSecond * 4;
            assert.ok(
                wakeupDelta >= expectedWakeups - 2 &&
                    wakeupDelta <= expectedWakeups + 2,
                `${targetFramesPerSecond} FPS semantic work woke ${wakeupDelta} times on ${displayFramesPerSecond} Hz`,
            );
            assert.equal(wakeupDelta, invalidationDelta);
            assert.equal(
                end.postCalibrationFrameWakeupCount -
                    start.postCalibrationFrameWakeupCount,
                0,
            );
            assert.equal(
                end.unexpectedNoWorkWakeupCount -
                    start.unexpectedNoWorkWakeupCount,
                0,
            );
            assertWakeupClassificationConserved(end);
            assert.equal(
                queue.taskHistory.filter(
                    (task) => task.source === 'scheduler-frame',
                ).length,
                calibrationFrameCount,
                'Steady semantic cadence must not restart scheduler RAF polling',
            );
            assert.equal(end.pendingCallbackKind, 'timeout');
            assert.ok(end.pendingCallbackDueAt !== null);

            const steadyFrames = frameCallbackTimes.filter(
                (timestamp) => timestamp >= 1_000 && timestamp <= 5_000,
            );
            const firstFrame = steadyFrames[0];
            const lastFrame = steadyFrames.at(-1);
            assert.ok(firstFrame !== undefined && lastFrame !== undefined);
            const renderedFramesPerSecond =
                ((steadyFrames.length - 1) * 1000) / (lastFrame - firstFrame);
            assert.ok(
                renderedFramesPerSecond >= targetFramesPerSecond - 1 &&
                    renderedFramesPerSecond <= targetFramesPerSecond + 1,
                `${targetFramesPerSecond} FPS semantic work rendered at ${renderedFramesPerSecond} FPS on ${displayFramesPerSecond} Hz`,
            );
            assert.ok(queue.maximumPendingTaskCount <= 2);

            release();
        });
    }

    it('uses the highest named lease, an ambient fallback, and live rate changes', () => {
        const { queue, scheduler } = createScheduler();
        const releaseAmbient = scheduler.acquireRenderLease('ambient');
        const releaseInteractive = scheduler.acquireRenderLease(
            'interaction',
            60,
        );
        const releaseSecondInteraction = scheduler.acquireRenderLease(
            'interaction',
            20,
        );

        assert.deepEqual(scheduler.getSnapshot().renderLeaseOwners, [
            'ambient',
            'interaction',
        ]);
        assert.deepEqual(scheduler.getSnapshot().renderLeaseSummaries, [
            { framesPerSecond: 30, leaseCount: 1, owner: 'ambient' },
            {
                framesPerSecond: 60,
                leaseCount: 2,
                owner: 'interaction',
            },
        ]);
        assert.equal(scheduler.getSnapshot().activeRenderLeaseCount, 3);
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 60);
        releaseInteractive();
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 30);

        scheduler.setAmbientFramesPerSecond(20);
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 20);
        scheduler.setBaseFramesPerSecond(40);
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 40);
        releaseAmbient();
        scheduler.setBaseFramesPerSecond(0);
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 20);
        releaseSecondInteraction();
        releaseSecondInteraction();

        const snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.targetFramesPerSecond, 0);
        assert.equal(snapshot.activeLeaseCount, 0);
        assert.equal(snapshot.leaseAcquiredCount, 3);
        assert.equal(snapshot.leaseReleasedCount, 3);
        assert.equal(queue.pendingTaskCount, 0);
        assert.equal(queue.maximumPendingTaskCount, 1);
    });

    it('shares identical owner/rate leases until the final release', () => {
        const { queue, scheduler } = createScheduler();
        const releaseFirst = scheduler.acquireSharedRenderLease('plant-sway');
        const releaseSecond = scheduler.acquireSharedRenderLease('plant-sway');
        const releaseInteractive = scheduler.acquireSharedRenderLease(
            'plant-sway',
            60,
        );

        let snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.activeRenderLeaseCount, 2);
        assert.deepEqual(snapshot.renderLeaseSummaries, [
            { framesPerSecond: 60, leaseCount: 2, owner: 'plant-sway' },
        ]);
        assert.equal(snapshot.leaseAcquiredCount, 2);

        releaseFirst();
        releaseFirst();
        assert.equal(scheduler.getSnapshot().activeRenderLeaseCount, 2);
        releaseSecond();
        snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.activeRenderLeaseCount, 1);
        assert.equal(snapshot.targetFramesPerSecond, 60);

        releaseInteractive();
        assert.equal(scheduler.getSnapshot().activeRenderLeaseCount, 0);
        assert.equal(scheduler.getSnapshot().leaseReleasedCount, 2);
        assert.equal(queue.pendingTaskCount, 0);
    });

    it('does not burst when the render rate drops while a frame is awaiting receipt', () => {
        const { frameCallbackTimes, invalidations, queue, scheduler } =
            createScheduler({ simulateFrameCallbacks: true });
        const releaseAmbient = scheduler.acquireRenderLease('ambient', 20);
        const releaseInteractive = scheduler.acquireRenderLease(
            'interaction',
            60,
        );

        queue.runNext();
        assert.deepEqual(invalidations, [1000 / 60]);
        releaseInteractive();
        queue.runUntil(100);

        assert.equal(frameCallbackTimes.length, 2);
        assertNear(frameCallbackTimes[0] ?? 0, (2 * 1000) / 60);
        assertNear(frameCallbackTimes[1] ?? 0, (5 * 1000) / 60);
        assertNear(
            (frameCallbackTimes[1] ?? 0) - (frameCallbackTimes[0] ?? 0),
            1000 / 20,
        );
        assert.equal(scheduler.getSnapshot().missedFrameReceiptCount, 0);
        releaseAmbient();
    });

    it('collapses overdue render work to one invalidation and a future target', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });
        const release = scheduler.acquireRenderLease('overdue-render', 30);
        queue.runUntil(500);

        const overdueTask = [...queue.tasks.values()].find(
            (task) => task.source === 'timeout',
        );
        assert.equal(overdueTask?.source, 'timeout');
        const overdueAt = (overdueTask?.dueAt ?? queue.currentTime) + 250;
        const invalidationCount = invalidations.length;
        assert.ok(overdueTask);
        queue.runTask(overdueTask, overdueAt);

        assert.equal(invalidations.length, invalidationCount + 1);
        const snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.pendingCallbackKind, 'timeout');
        assert.ok(
            snapshot.pendingCallbackDueAt !== null &&
                snapshot.pendingCallbackDueAt > overdueAt,
        );
        assert.ok(queue.maximumPendingTaskCount <= 2);

        queue.runUntil(overdueAt + 50);
        release();
    });

    it('preserves 20/30/60 FPS averages across non-divisor display refresh rates', () => {
        for (const displayFramesPerSecond of [60, 75, 90, 120, 144]) {
            for (const targetFramesPerSecond of [20, 30, 60]) {
                const queue = new FakeRuntimeQueue(displayFramesPerSecond);
                const { frameCallbackTimes, scheduler } = createScheduler({
                    queue,
                    simulateFrameCallbacks: true,
                });
                const release = scheduler.acquireRenderLease(
                    'refresh-matrix',
                    targetFramesPerSecond,
                );

                queue.runUntil(5_000);
                const steadyFrameCallbackTimes = frameCallbackTimes.slice(8);
                const firstFrame = steadyFrameCallbackTimes[0];
                const lastFrame = steadyFrameCallbackTimes.at(-1);
                assert.ok(firstFrame !== undefined && lastFrame !== undefined);
                const observedFramesPerSecond =
                    ((steadyFrameCallbackTimes.length - 1) * 1000) /
                    (lastFrame - firstFrame);
                assert.ok(
                    observedFramesPerSecond <= targetFramesPerSecond + 0.75,
                    `${targetFramesPerSecond} FPS target exceeded on ${displayFramesPerSecond} Hz: ${observedFramesPerSecond}`,
                );
                assert.ok(
                    observedFramesPerSecond >= targetFramesPerSecond - 1.5,
                    `${targetFramesPerSecond} FPS target missed on ${displayFramesPerSecond} Hz: ${observedFramesPerSecond}`,
                );
                release();
            }
        }
    });

    it('calibrates across a dropped refresh and callback receipt jitter', () => {
        const queue = new FakeRuntimeQueue(
            60,
            [1, 2, 1, 1, 1],
            createDeterministicCallbackDelays(200, 3),
        );
        const { frameCallbackTimes, scheduler } = createScheduler({
            queue,
            simulateFrameCallbacks: true,
        });
        const release = scheduler.acquireRenderLease('dropped-refresh', 30);

        queue.runUntil(2_000);
        const steadyFrameCallbackTimes = frameCallbackTimes.slice(8);
        const firstFrame = steadyFrameCallbackTimes[0];
        const lastFrame = steadyFrameCallbackTimes.at(-1);
        assert.ok(firstFrame !== undefined && lastFrame !== undefined);
        const observedFramesPerSecond =
            ((steadyFrameCallbackTimes.length - 1) * 1000) /
            (lastFrame - firstFrame);
        assert.ok(observedFramesPerSecond >= 29);
        assert.ok(observedFramesPerSecond <= 30.75);
        const snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.displayFrameCalibrationCount, 1);
        assertNear(snapshot.displayFrameIntervalMs ?? 0, 1000 / 60);
        assert.equal(snapshot.missedFrameReceiptCount, 0);
        release();
    });

    it('keeps cadence stable when frame callback receipt work is jittered', () => {
        for (const maximumDelayMs of [0.25, 0.5, 1, 2, 3]) {
            for (const targetFramesPerSecond of [20, 30, 60]) {
                const queue = new FakeRuntimeQueue(
                    60,
                    [],
                    createDeterministicCallbackDelays(2_000, maximumDelayMs),
                );
                const { frameCallbackTimes, scheduler } = createScheduler({
                    queue,
                    simulateFrameCallbacks: true,
                });
                const release = scheduler.acquireRenderLease(
                    'callback-jitter',
                    targetFramesPerSecond,
                );

                queue.runUntil(20_000, 10_000);
                const steadyFrameCallbackTimes = frameCallbackTimes.filter(
                    (time) => time >= 5_000 && time <= 19_500,
                );
                const firstFrame = steadyFrameCallbackTimes[0];
                const lastFrame = steadyFrameCallbackTimes.at(-1);
                assert.ok(firstFrame !== undefined && lastFrame !== undefined);
                const observedFramesPerSecond =
                    ((steadyFrameCallbackTimes.length - 1) * 1000) /
                    (lastFrame - firstFrame);
                assert.ok(
                    observedFramesPerSecond <= targetFramesPerSecond + 0.25,
                    `${targetFramesPerSecond} FPS target exceeded with ${maximumDelayMs}ms callback jitter: ${observedFramesPerSecond}`,
                );
                assert.ok(
                    observedFramesPerSecond >= targetFramesPerSecond - 0.25,
                    `${targetFramesPerSecond} FPS target missed with ${maximumDelayMs}ms callback jitter: ${observedFramesPerSecond}`,
                );
                const snapshot = scheduler.getSnapshot();
                assert.equal(snapshot.displayFrameCalibrationCount, 1);
                assertNear(snapshot.displayFrameIntervalMs ?? 0, 1000 / 60);
                assert.ok(
                    snapshot.invalidationCount - snapshot.wakeupCount <= 7,
                    'Stable callback jitter must not restart calibration',
                );
                release();
            }
        }
    });

    it('keeps one calibration and exact cadence on variable-refresh RAF', () => {
        const variableDisplayIntervalsMs = [
            9.3, 11.8, 8.3, 12.5, 10.1, 13.2, 8.9, 9.7,
        ];
        for (const targetFramesPerSecond of [20, 30, 60]) {
            const queue = new FakeRuntimeQueue(
                60,
                [],
                createDeterministicCallbackDelays(2_000, 3),
                variableDisplayIntervalsMs,
            );
            const { frameCallbackTimes, scheduler } = createScheduler({
                queue,
                simulateFrameCallbacks: true,
            });
            const release = scheduler.acquireRenderLease(
                'variable-refresh',
                targetFramesPerSecond,
            );

            queue.runUntil(20_000, 10_000);
            const steadyFrameCallbackTimes = frameCallbackTimes.filter(
                (time) => time >= 5_000 && time <= 19_500,
            );
            const firstFrame = steadyFrameCallbackTimes[0];
            const lastFrame = steadyFrameCallbackTimes.at(-1);
            assert.ok(firstFrame !== undefined && lastFrame !== undefined);
            const observedFramesPerSecond =
                ((steadyFrameCallbackTimes.length - 1) * 1000) /
                (lastFrame - firstFrame);
            assert.ok(
                observedFramesPerSecond <= targetFramesPerSecond + 0.25,
                `${targetFramesPerSecond} FPS target exceeded on variable refresh: ${observedFramesPerSecond}`,
            );
            assert.ok(
                observedFramesPerSecond >= targetFramesPerSecond - 0.25,
                `${targetFramesPerSecond} FPS target missed on variable refresh: ${observedFramesPerSecond}`,
            );
            const snapshot = scheduler.getSnapshot();
            assert.equal(snapshot.displayFrameCalibrationCount, 1);
            assertNear(snapshot.displayFrameIntervalMs ?? 0, 10.1);
            assert.ok(
                snapshot.invalidationCount - snapshot.wakeupCount <= 7,
                'Variable refresh must not restart bounded calibration',
            );
            assert.equal(snapshot.missedFrameReceiptCount, 0);
            assert.ok(queue.maximumPendingTaskCount <= 2);
            release();
        }
    });

    it('bounds calibration when every display interval is out of range', () => {
        const queue = new FakeRuntimeQueue(10);
        const { scheduler } = createScheduler({
            queue,
            simulateFrameCallbacks: true,
        });
        const release = scheduler.acquireRenderLease(
            'out-of-range-calibration',
            20,
        );

        queue.runUntil(2_000);
        const firstSnapshot = scheduler.getSnapshot();
        const calibrationFrameCount = queue.taskHistory.filter(
            (task) => task.source === 'scheduler-frame',
        ).length;
        assert.equal(firstSnapshot.displayFrameCalibrationCount, 1);
        assertNear(firstSnapshot.displayFrameIntervalMs ?? 0, 1000 / 60);
        assert.ok(calibrationFrameCount <= 13);

        queue.runUntil(5_000);
        const finalSnapshot = scheduler.getSnapshot();
        assert.equal(finalSnapshot.displayFrameCalibrationCount, 1);
        assert.equal(
            queue.taskHistory.filter(
                (task) => task.source === 'scheduler-frame',
            ).length,
            calibrationFrameCount,
            'Fallback calibration must not leave a permanent scheduler RAF loop',
        );
        release();
    });

    it('coalesces owned invalidations through an external frame burst', () => {
        const queue = new FakeRuntimeQueue(60);
        const { invalidations, scheduler } = createScheduler({
            queue,
            simulateFrameCallbacks: true,
        });
        const release = scheduler.acquireRenderLease('external-burst', 30);
        queue.runUntil(500);
        const burstStartedAt = queue.currentTime;
        const invalidationsBeforeBurst = invalidations.length;
        const snapshotBeforeBurst = scheduler.getSnapshot();

        for (let frame = 1; frame <= 12; frame += 1) {
            queue.runUntil(burstStartedAt + frame * 15);
            scheduler.recordFrameCallback(queue.currentTime);
        }
        const invalidationsAfterBurst = invalidations.length;
        assert.ok(
            invalidationsAfterBurst <= invalidationsBeforeBurst + 1,
            'External frames must satisfy rather than duplicate semantic cadence slots',
        );
        const snapshotAfterBurst = scheduler.getSnapshot();
        const scheduledCallbackDelta =
            snapshotAfterBurst.scheduledCallbackCount -
            snapshotBeforeBurst.scheduledCallbackCount;
        const maximumDisplayCallbacksDuringBurst =
            Math.ceil((12 * 15) / (1000 / queue.displayFramesPerSecond)) + 2;
        assert.ok(
            scheduledCallbackDelta <= maximumDisplayCallbacksDuringBurst,
            `External frames scheduled ${scheduledCallbackDelta} callbacks during a ${12 * 15}ms burst`,
        );
        assert.ok(
            snapshotAfterBurst.cancelledCallbackCount -
                snapshotBeforeBurst.cancelledCallbackCount <=
                1,
            'External frames must not cancel and rearm one timer per receipt',
        );
        assert.equal(snapshotAfterBurst.displayFrameCalibrationCount, 1);
        const burstEndedAt = queue.currentTime;
        queue.runUntil(burstEndedAt + 700);

        assert.ok(
            invalidations.length >= invalidationsAfterBurst + 18 &&
                invalidations.length <= invalidationsAfterBurst + 22,
            'Owned cadence must resume after external rendering stops',
        );
        release();
    });

    it('combines a 15 FPS external source with owned work under a 30 FPS cap', () => {
        const queue = new FakeRuntimeQueue(60);
        const { invalidations, recordExternalFrame, scheduler } =
            createScheduler({
                queue,
                simulateFrameCallbacks: true,
            });
        const release = scheduler.acquireRenderLease('external-source', 30);
        queue.runUntil(500);
        const sampleStartedAt = queue.currentTime;
        const sampleEndedAt = sampleStartedAt + 2_000;
        const invalidationsAtStart = invalidations.length;
        const snapshotAtStart = scheduler.getSnapshot();
        const callbacksAtStart = snapshotAtStart.r3fFrameCallbackCount;

        for (let frame = 0; frame < 30; frame += 1) {
            const externalFrameAt = sampleStartedAt + 8 + frame * (1000 / 15);
            queue.runUntil(externalFrameAt);
            recordExternalFrame(externalFrameAt);
        }
        queue.runUntil(sampleEndedAt);

        const ownedInvalidations = invalidations.length - invalidationsAtStart;
        assert.ok(
            ownedInvalidations >= 28 && ownedInvalidations <= 62,
            `Expected owned invalidations to remain within the 30 FPS cap, received ${ownedInvalidations / 2} FPS`,
        );
        const snapshotAtEnd = scheduler.getSnapshot();
        const renderedFrames =
            snapshotAtEnd.r3fFrameCallbackCount - callbacksAtStart;
        assert.ok(
            renderedFrames >= 58 && renderedFrames <= 62,
            `Expected a combined 30 FPS cap, received ${renderedFrames / 2} FPS`,
        );
        assert.ok(
            snapshotAtEnd.wakeupCount - snapshotAtStart.wakeupCount <= 62,
            'External rendering must not raise scheduler wakeups above semantic cadence',
        );
        assert.ok(queue.maximumPendingTaskCount <= 2);
        assert.equal(scheduler.getSnapshot().displayFrameCalibrationCount, 1);
        release();
    });

    it('counts a render follow-up as the next semantic cadence slot', () => {
        const queue = new FakeRuntimeQueue(100);
        const { invalidations, requestExternalFrame, scheduler } =
            createScheduler({
                queue,
                simulateFrameCallbacks: true,
            });
        const release = scheduler.acquireRenderLease(
            'self-invalidation-follow-up',
            30,
        );
        queue.runUntil(500);
        const sampleStartedAt = queue.currentTime;
        const sampleEndedAt = sampleStartedAt + 2_000;
        const snapshotAtStart = scheduler.getSnapshot();
        let observedInvalidationCount = invalidations.length;
        let followUpDueAfterNextRender = false;

        while ((queue.peekNextTask()?.dueAt ?? Infinity) <= sampleEndedAt) {
            const task = queue.runNext();
            if (invalidations.length > observedInvalidationCount) {
                observedInvalidationCount = invalidations.length;
                followUpDueAfterNextRender = true;
            }
            if (
                task.source === 'renderer-frame' &&
                followUpDueAfterNextRender
            ) {
                followUpDueAfterNextRender = false;
                requestExternalFrame();
            }
        }
        queue.runUntil(sampleEndedAt);

        const snapshotAtEnd = scheduler.getSnapshot();
        const renderedFrames =
            snapshotAtEnd.r3fFrameCallbackCount -
            snapshotAtStart.r3fFrameCallbackCount;
        assert.ok(
            renderedFrames >= 58 && renderedFrames <= 62,
            `Expected follow-up rendering to stay within the 30 FPS cap, received ${renderedFrames / 2} FPS`,
        );
        assert.ok(
            snapshotAtEnd.ownedInvalidationCount -
                snapshotAtStart.ownedInvalidationCount <=
                32,
            'Follow-up frames must consume pending owned cadence slots',
        );
        assert.equal(snapshotAtEnd.pendingCallbackKind, 'timeout');
        assert.ok(queue.maximumPendingTaskCount <= 2);
        release();
    });

    it('consumes a first follow-up delayed beyond one display interval', () => {
        const queue = new FakeRuntimeQueue(100);
        const { invalidations, recordExternalFrame, scheduler } =
            createScheduler({
                queue,
                simulateFrameCallbacks: true,
            });
        const release = scheduler.acquireRenderLease(
            'delayed-self-invalidation-follow-up',
            30,
        );
        queue.runUntil(500);

        let invalidationCount = invalidations.length;
        let callbackCount = 0;
        while (invalidations.length === invalidationCount) {
            assert.ok(
                callbackCount++ < 10,
                'Expected the next semantic invalidation',
            );
            queue.runNext();
        }
        invalidationCount = invalidations.length;
        let ownedReceipt: FakeTask | undefined;
        while (!ownedReceipt) {
            assert.ok(
                callbackCount++ < 20,
                'Expected the owned renderer receipt',
            );
            const task = queue.runNext();
            if (task.source === 'renderer-frame') {
                ownedReceipt = task;
            }
        }

        const ownedReceiptAt = ownedReceipt.frameTimestamp;
        assert.ok(ownedReceiptAt !== undefined);
        const pendingSlotDueAt = scheduler.getSnapshot().pendingCallbackDueAt;
        assert.ok(pendingSlotDueAt !== null);
        const displayIntervalMs = 1000 / queue.displayFramesPerSecond;
        const semanticIntervalMs = 1000 / 30;
        const followUpAt = ownedReceiptAt + displayIntervalMs + 1;
        assert.ok(followUpAt < pendingSlotDueAt);
        recordExternalFrame(followUpAt);
        const retainedCallbackAt = queue.peekNextTask()?.dueAt;
        assert.ok(retainedCallbackAt !== undefined);
        assert.ok(retainedCallbackAt >= pendingSlotDueAt);
        assert.ok(retainedCallbackAt < pendingSlotDueAt + 1);

        queue.runNext();
        const nextDueAt = scheduler.getSnapshot().pendingCallbackDueAt;
        assert.ok(nextDueAt !== null);
        assertNear(nextDueAt, pendingSlotDueAt + semanticIntervalMs);
        const deliveryCallbackAt = queue.peekNextTask()?.dueAt;
        assert.ok(deliveryCallbackAt !== undefined);
        assert.ok(deliveryCallbackAt >= nextDueAt);
        assert.ok(deliveryCallbackAt < nextDueAt + 1);

        queue.runUntil(nextDueAt);
        assert.equal(invalidations.length, invalidationCount);
        queue.runNext();
        assert.equal(invalidations.length, invalidationCount + 1);
        release();
    });

    it('moves the next target without rearming for same-task external receipts', () => {
        const queue = new FakeRuntimeQueue(60);
        const { recordExternalFrame, scheduler } = createScheduler({
            queue,
            simulateFrameCallbacks: true,
        });
        const release = scheduler.acquireRenderLease('external-burst', 30);
        queue.runUntil(500);
        const invalidationCount = scheduler.getSnapshot().invalidationCount;

        queue.currentTime = 501;
        recordExternalFrame(501);
        queue.currentTime = 502;
        recordExternalFrame(502);

        const snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.pendingCallbackKind, 'timeout');
        assert.ok(snapshot.pendingCallbackDueAt !== null);
        queue.runUntil(534);
        assert.equal(
            scheduler.getSnapshot().invalidationCount,
            invalidationCount,
            'External receipts did not defer the next owned cadence slot',
        );
        const recoveryDeadline = 502 + 1000 / 30 + 1000 / 60;
        queue.runUntil(recoveryDeadline);
        assert.ok(
            scheduler.getSnapshot().invalidationCount > invalidationCount,
            'Ambient rendering did not recover within one cadence plus one display frame',
        );
        release();
    });

    it('keeps an unnamed lease inert when both compatibility rates are zero', () => {
        const { queue, scheduler } = createScheduler({
            options: {
                ambientFramesPerSecond: 0,
                baseFramesPerSecond: 0,
            },
        });
        const releaseAmbient = scheduler.acquireRenderLease('ambient');
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 0);
        assert.equal(queue.pendingTaskCount, 0);

        const releaseInteractive = scheduler.acquireRenderLease(
            'interaction',
            60,
        );
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 60);
        assert.equal(queue.pendingTaskCount, 1);
        releaseInteractive();
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 0);
        assert.equal(queue.pendingTaskCount, 0);
        releaseAmbient();
    });

    it('preserves cadence when the display refresh rate changes in place', () => {
        for (const fasterDisplayFramesPerSecond of [61, 65, 75, 90, 120]) {
            for (const targetFramesPerSecond of [20, 30, 60]) {
                const queue = new FakeRuntimeQueue(60);
                const { frameCallbackTimes, scheduler } = createScheduler({
                    queue,
                    simulateFrameCallbacks: true,
                });
                const release = scheduler.acquireRenderLease(
                    'refresh-transition',
                    targetFramesPerSecond,
                );

                queue.runUntil(1_000);
                queue.displayFramesPerSecond = fasterDisplayFramesPerSecond;
                queue.runUntil(6_000);
                const fasterDisplayFrames = frameCallbackTimes.filter(
                    (time) => time >= 4_000 && time <= 5_900,
                );
                const fasterFirst = fasterDisplayFrames[0];
                const fasterLast = fasterDisplayFrames.at(-1);
                assert.ok(
                    fasterFirst !== undefined && fasterLast !== undefined,
                );
                const fasterObservedFramesPerSecond =
                    ((fasterDisplayFrames.length - 1) * 1000) /
                    (fasterLast - fasterFirst);
                assert.ok(
                    fasterObservedFramesPerSecond <=
                        targetFramesPerSecond + 0.75,
                    `${targetFramesPerSecond} FPS target exceeded after 60 to ${fasterDisplayFramesPerSecond} Hz: ${fasterObservedFramesPerSecond}`,
                );
                assert.ok(
                    fasterObservedFramesPerSecond >=
                        targetFramesPerSecond - 1.5,
                    `${targetFramesPerSecond} FPS target missed after 60 to ${fasterDisplayFramesPerSecond} Hz: ${fasterObservedFramesPerSecond}`,
                );

                queue.displayFramesPerSecond = 60;
                queue.runUntil(10_000);
                const slowerDisplayFrames = frameCallbackTimes.filter(
                    (time) => time >= 8_000 && time <= 9_900,
                );
                const slowerFirst = slowerDisplayFrames[0];
                const slowerLast = slowerDisplayFrames.at(-1);
                assert.ok(
                    slowerFirst !== undefined && slowerLast !== undefined,
                );
                const slowerObservedFramesPerSecond =
                    ((slowerDisplayFrames.length - 1) * 1000) /
                    (slowerLast - slowerFirst);
                assert.ok(
                    slowerObservedFramesPerSecond <=
                        targetFramesPerSecond + 0.75,
                    `${targetFramesPerSecond} FPS target exceeded after ${fasterDisplayFramesPerSecond} to 60 Hz: ${slowerObservedFramesPerSecond}`,
                );
                assert.ok(
                    slowerObservedFramesPerSecond >=
                        targetFramesPerSecond - 1.5,
                    `${targetFramesPerSecond} FPS target missed after ${fasterDisplayFramesPerSecond} to 60 Hz: ${slowerObservedFramesPerSecond}`,
                );
                assert.equal(
                    scheduler.getSnapshot().displayFrameCalibrationCount,
                    1,
                );
                release();
            }
        }
    });

    it('avoids receipt bursts after moving from a slow to fast display', () => {
        const transitions = [
            { from: 30, target: 60, to: 120 },
            { from: 20, target: 60, to: 240 },
            { from: 30, target: 30, to: 120 },
        ];

        for (const transition of transitions) {
            const queue = new FakeRuntimeQueue(transition.from);
            const { frameCallbackTimes, scheduler } = createScheduler({
                queue,
                simulateFrameCallbacks: true,
            });
            const release = scheduler.acquireRenderLease(
                'slow-to-fast-display',
                transition.target,
            );

            queue.runUntil(1_000);
            queue.displayFramesPerSecond = transition.to;
            queue.runUntil(4_000);
            const steadyFrameCallbackTimes = frameCallbackTimes.filter(
                (time) => time >= 2_000 && time <= 3_900,
            );
            assert.ok(steadyFrameCallbackTimes.length > 2);
            const gaps = steadyFrameCallbackTimes
                .slice(1)
                .map(
                    (time, index) =>
                        time - (steadyFrameCallbackTimes[index] ?? time),
                );
            const targetIntervalMs = 1000 / transition.target;
            const displayIntervalMs = 1000 / transition.to;
            const minimumExpectedGapMs =
                targetIntervalMs - displayIntervalMs - timingToleranceMs;
            const maximumExpectedGapMs =
                targetIntervalMs + displayIntervalMs + timingToleranceMs;
            assert.ok(
                Math.min(...gaps) >= minimumExpectedGapMs,
                `${transition.from} to ${transition.to} Hz produced a ${Math.min(...gaps)}ms burst at ${transition.target} FPS`,
            );
            assert.ok(
                Math.max(...gaps) <= maximumExpectedGapMs,
                `${transition.from} to ${transition.to} Hz produced a ${Math.max(...gaps)}ms gap at ${transition.target} FPS`,
            );
            assert.equal(
                scheduler.getSnapshot().displayFrameCalibrationCount,
                1,
            );
            release();
        }
    });

    it('keeps exact frame gaps across divisor refresh transitions', () => {
        const transitions = [
            { target: 20, to: 120 },
            { target: 30, to: 120 },
            { target: 60, to: 120 },
            { target: 20, to: 240 },
            { target: 30, to: 240 },
            { target: 60, to: 240 },
        ];

        for (const transition of transitions) {
            const queue = new FakeRuntimeQueue(60);
            const { frameCallbackTimes, scheduler } = createScheduler({
                queue,
                simulateFrameCallbacks: true,
            });
            const release = scheduler.acquireRenderLease(
                'divisor-display-transition',
                transition.target,
            );

            queue.runUntil(1_000);
            queue.displayFramesPerSecond = transition.to;
            queue.runUntil(4_000);
            const steadyFrameCallbackTimes = frameCallbackTimes.filter(
                (time) => time >= 2_000 && time <= 3_900,
            );
            assert.ok(steadyFrameCallbackTimes.length > 2);
            for (
                let index = 1;
                index < steadyFrameCallbackTimes.length;
                index += 1
            ) {
                assertNear(
                    (steadyFrameCallbackTimes[index] ?? 0) -
                        (steadyFrameCallbackTimes[index - 1] ?? 0),
                    1000 / transition.target,
                );
            }
            assert.equal(
                scheduler.getSnapshot().displayFrameCalibrationCount,
                1,
            );
            release();
        }
    });
});

describe('GameRuntimeScheduler semantic work', () => {
    it('coalesces an active 30 FPS request burst without raising cadence or rearming', () => {
        const { frameCallbackTimes, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });
        const release = scheduler.acquireRenderLease('ambient', 30);
        const before = scheduler.getSnapshot();

        scheduler.requestCoalescedRender('r3f-host', 3);
        scheduler.requestCoalescedRender('r3f-host');
        scheduler.requestCoalescedRender('r3f-reconciler');

        const pending = scheduler.getSnapshot();
        assert.equal(pending.targetFramesPerSecond, 30);
        assert.equal(
            pending.scheduledCallbackCount,
            before.scheduledCallbackCount,
        );
        assert.equal(
            pending.cancelledCallbackCount,
            before.cancelledCallbackCount,
        );
        assert.equal(
            pending.hiddenCoalescedRenderRequestCount,
            before.hiddenCoalescedRenderRequestCount,
        );
        assert.equal(
            pending.hiddenDeferredCoalescedRenderRequestCount,
            before.hiddenDeferredCoalescedRenderRequestCount,
        );
        assert.deepEqual(pending.renderRequestReasons, []);
        assert.deepEqual(pending.coalescedRenderRequestReasons, [
            'r3f-host',
            'r3f-reconciler',
        ]);
        assert.equal(queue.pendingTaskCount, 1);

        queue.runUntil(1_000);
        const steadyFrameCallbackTimes = frameCallbackTimes.filter(
            (timestamp) => timestamp >= 300,
        );
        assert.ok(steadyFrameCallbackTimes.length >= 4);
        for (
            let index = 1;
            index < steadyFrameCallbackTimes.length;
            index += 1
        ) {
            assertNear(
                (steadyFrameCallbackTimes[index] ?? 0) -
                    (steadyFrameCallbackTimes[index - 1] ?? 0),
                1000 / 30,
            );
        }
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
        release();
    });

    it('preserves the maximum explicit coalesced frame count without summing bursts', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });

        scheduler.requestCoalescedRender('r3f-host', 3);
        scheduler.requestCoalescedRender('r3f-host', 2);
        scheduler.requestCoalescedRender('r3f-host');

        queue.runUntil(100);
        assert.equal(invalidations.length, 3);
        assertNear(
            (invalidations[1] ?? 0) - (invalidations[0] ?? 0),
            1000 / 60,
        );
        assertNear(
            (invalidations[2] ?? 0) - (invalidations[1] ?? 0),
            1000 / 60,
        );
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
        assert.equal(queue.pendingTaskCount, 0);
    });

    it('does not resolve the schedule again for a saturated active-lease burst', () => {
        const queue = new FakeRuntimeQueue();
        let nowReadCount = 0;
        const { scheduler } = createScheduler({
            options: {
                now: () => {
                    nowReadCount += 1;
                    return queue.currentTime;
                },
            },
            queue,
        });
        const release = scheduler.acquireRenderLease('ambient', 30);
        const historyCount = queue.taskHistory.length;
        const nowReadsBeforeBurst = nowReadCount;
        const before = scheduler.getSnapshot();

        for (let request = 0; request < 10_000; request += 1) {
            scheduler.requestCoalescedRender('r3f-host');
        }

        const after = scheduler.getSnapshot();
        assert.equal(nowReadCount, nowReadsBeforeBurst);
        assert.equal(queue.taskHistory.length, historyCount);
        assert.equal(
            after.scheduledCallbackCount,
            before.scheduledCallbackCount,
        );
        assert.equal(
            after.cancelledCallbackCount,
            before.cancelledCallbackCount,
        );
        assert.deepEqual(after.coalescedRenderRequestReasons, ['r3f-host']);
        assert.equal(queue.pendingTaskCount, 1);
        release();
    });

    it('raises an idle coalesced request without rearming its 60 FPS callback', () => {
        const { queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });

        scheduler.requestCoalescedRender('r3f-host');
        const firstTask = queue.peekNextTask();
        const first = scheduler.getSnapshot();
        scheduler.requestCoalescedRender('r3f-host', 3);
        const raised = scheduler.getSnapshot();

        assert.equal(queue.peekNextTask(), firstTask);
        assert.equal(queue.taskHistory.length, 1);
        assert.equal(
            raised.scheduledCallbackCount,
            first.scheduledCallbackCount,
        );
        assert.equal(
            raised.cancelledCallbackCount,
            first.cancelledCallbackCount,
        );
        queue.runUntil(100);
        assert.equal(raised.targetFramesPerSecond, 0);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
    });

    it('counts a hidden duplicate burst without scheduling duplicate work', () => {
        const snapshots: GameRuntimeSchedulerSnapshot[] = [];
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
            snapshots,
        });
        scheduler.setDocumentVisible(false);

        for (let request = 0; request < 10_000; request += 1) {
            scheduler.requestCoalescedRender('r3f-host', 3);
        }

        const hidden = scheduler.getSnapshot();
        assert.equal(hidden.hiddenCoalescedRenderRequestCount, 10_000);
        assert.equal(hidden.hiddenDeferredCoalescedRenderRequestCount, 1);
        assert.deepEqual(hidden.coalescedRenderRequestReasons, ['r3f-host']);
        assert.equal(queue.taskHistory.length, 0);
        assert.equal(queue.pendingTaskCount, 0);
        assert.deepEqual(snapshots.at(-1)?.coalescedRenderRequestReasons, [
            'r3f-host',
        ]);

        scheduler.setDocumentVisible(true);
        queue.runUntil(100);
        assert.equal(invalidations.length, 1);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
    });

    it('reconciles a coalesced request made inside the invalidation effect', () => {
        let requested = false;
        let schedulerRef: GameRuntimeScheduler | null = null;
        const { queue, scheduler } = createScheduler({
            options: {
                invalidate: () => {
                    if (requested) {
                        return;
                    }
                    requested = true;
                    schedulerRef?.requestCoalescedRender('r3f-host', 2);
                },
            },
            simulateFrameCallbacks: true,
        });
        schedulerRef = scheduler;
        const release = scheduler.acquireRenderLease('ambient', 30);

        queue.runNext();

        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            ['r3f-host'],
        );
        assert.equal(queue.pendingTaskCount, 2);
        queue.runUntil(100);
        assert.ok(scheduler.getSnapshot().r3fFrameCallbackCount > 0);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
        release();
    });

    it('retains one coalesced follow-up after the current external frame receipt', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });
        scheduler.requestCoalescedRender('r3f-host', 2);

        scheduler.recordFrameCallback(queue.currentTime);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            ['r3f-host'],
        );
        assert.equal(invalidations.length, 0);
        assert.equal(queue.pendingTaskCount, 1);

        queue.runUntil(40);
        assert.equal(invalidations.length, 1);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
        assert.equal(queue.pendingTaskCount, 0);
    });

    it('renders one coalesced request while otherwise idle', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });

        assert.equal(scheduler.requestCoalescedRender('r3f-host'), true);
        const pending = scheduler.getSnapshot();
        assert.equal(pending.targetFramesPerSecond, 0);
        assert.equal(pending.hiddenCoalescedRenderRequestCount, 0);
        assert.equal(pending.hiddenDeferredCoalescedRenderRequestCount, 0);
        assert.deepEqual(pending.renderRequestReasons, []);
        assert.deepEqual(pending.coalescedRenderRequestReasons, ['r3f-host']);

        queue.runUntil(100);
        assert.equal(invalidations.length, 1);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
        assert.equal(scheduler.getSnapshot().pendingCallbackKind, 'none');
        assert.equal(queue.pendingTaskCount, 0);
    });

    it('defers hidden coalesced requests and renders one frame on resume', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });
        scheduler.setDocumentVisible(false);
        const ordinaryCountersBefore = scheduler.getSnapshot();

        scheduler.requestCoalescedRender('r3f-host', 3);
        scheduler.requestCoalescedRender('r3f-host');
        scheduler.requestCoalescedRender('r3f-host', 2);
        queue.runUntil(100);

        const hidden = scheduler.getSnapshot();
        assert.equal(invalidations.length, 0);
        assert.equal(queue.pendingTaskCount, 0);
        assert.deepEqual(hidden.renderRequestReasons, []);
        assert.deepEqual(hidden.coalescedRenderRequestReasons, ['r3f-host']);
        assert.equal(hidden.hiddenCoalescedRenderRequestCount, 3);
        assert.equal(hidden.hiddenDeferredCoalescedRenderRequestCount, 1);
        assert.equal(
            hidden.hiddenDeferredRenderRequestCount,
            ordinaryCountersBefore.hiddenDeferredRenderRequestCount,
        );
        assert.equal(
            hidden.deferredWorkCount,
            ordinaryCountersBefore.deferredWorkCount,
        );
        assert.equal(
            hidden.nonessentialHiddenWorkCount,
            ordinaryCountersBefore.nonessentialHiddenWorkCount,
        );

        scheduler.setDocumentVisible(true);
        queue.runUntil(200);
        assert.equal(invalidations.length, 1);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
        assert.equal(queue.pendingTaskCount, 0);

        scheduler.setDocumentVisible(false);
        scheduler.requestCoalescedRender('r3f-host');
        const repending = scheduler.getSnapshot();
        assert.equal(repending.hiddenCoalescedRenderRequestCount, 4);
        assert.equal(repending.hiddenDeferredCoalescedRenderRequestCount, 2);
        assert.deepEqual(repending.coalescedRenderRequestReasons, ['r3f-host']);
        assert.equal(
            repending.hiddenDeferredRenderRequestCount,
            ordinaryCountersBefore.hiddenDeferredRenderRequestCount,
        );
        assert.equal(
            repending.deferredWorkCount,
            ordinaryCountersBefore.deferredWorkCount,
        );
        assert.equal(
            repending.nonessentialHiddenWorkCount,
            ordinaryCountersBefore.nonessentialHiddenWorkCount,
        );

        scheduler.setDocumentVisible(true);
        queue.runUntil(300);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
    });

    it('finishes a coalesced request when the last lease is released before receipt', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });
        const release = scheduler.acquireRenderLease('ambient', 30);
        scheduler.requestCoalescedRender('r3f-host');

        queue.runNext();
        assert.equal(invalidations.length, 1);
        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, []);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            ['r3f-host'],
        );

        release();
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 0);
        queue.runUntil(100);
        assert.equal(invalidations.length, 1);
        assert.deepEqual(
            scheduler.getSnapshot().coalescedRenderRequestReasons,
            [],
        );
        assert.equal(queue.pendingTaskCount, 0);
    });

    it('keeps urgent multi-frame requests at 60 FPS during a 30 FPS lease', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });
        const release = scheduler.acquireRenderLease('ambient', 30);
        scheduler.requestRender('urgent', 2);

        queue.runUntil(100);
        assert.ok(invalidations.length >= 2);
        assertNear(
            (invalidations[1] ?? 0) - (invalidations[0] ?? 0),
            1000 / 60,
        );
        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, []);
        assert.equal(scheduler.getSnapshot().targetFramesPerSecond, 30);
        release();
    });

    it('lets an external frame satisfy a one-frame request without owned work', () => {
        const { invalidations, queue, scheduler } = createScheduler();
        scheduler.requestRender('external-one-frame');
        assert.equal(queue.pendingTaskCount, 1);

        scheduler.recordFrameCallback(queue.currentTime);

        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, []);
        assert.equal(scheduler.getSnapshot().pendingCallbackKind, 'none');
        assert.equal(scheduler.getSnapshot().cancelledCallbackCount, 1);
        assert.equal(invalidations.length, 0);
        assert.equal(queue.pendingTaskCount, 0);
    });

    it('uses one external receipt before finishing a two-frame request at 60 FPS', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });
        scheduler.requestRender('external-two-frames', 2);

        scheduler.recordFrameCallback(queue.currentTime);
        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, [
            'external-two-frames',
        ]);
        assert.equal(invalidations.length, 0);
        assert.equal(queue.pendingTaskCount, 1);

        queue.runUntil(40);
        assert.equal(invalidations.length, 1);
        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, []);
        assert.equal(queue.pendingTaskCount, 0);
    });

    it('coalesces reasons while preserving a two-frame request', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });

        assert.equal(scheduler.requestRender('selection', 2), true);
        assert.equal(scheduler.requestRender('selection', 1), true);
        assert.equal(scheduler.requestRender('terrain', 1), true);
        assert.equal(scheduler.requestRender('ignored', 0), false);
        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, [
            'selection',
            'terrain',
        ]);

        queue.runUntil(60);
        assert.equal(invalidations.length, 2);
        assertNear(invalidations[0] ?? -1, 1000 / 60);
        assertNear(invalidations[1] ?? 0, (2 * 1000) / 60);
        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, []);
        assert.equal(queue.pendingTaskCount, 0);
    });

    it('orders, replaces, cancels, and preempts named deadlines', () => {
        const { queue, scheduler } = createScheduler();
        const delivered: string[] = [];
        scheduler.scheduleDeadline('replace', 100, () =>
            delivered.push('stale'),
        );
        const staleTask = queue.taskHistory[0];
        assert.ok(staleTask);

        scheduler.scheduleDeadline('replace', 40, () =>
            delivered.push('replace'),
        );
        scheduler.scheduleDeadlineAfter('second', 40, () =>
            delivered.push('second'),
        );
        const cancel = scheduler.scheduleDeadlineAfter('cancelled', 20, () =>
            delivered.push('cancelled'),
        );
        cancel();
        cancel();

        queue.runUntil(40);
        assert.deepEqual(delivered, ['replace', 'second']);
        assert.equal(scheduler.getSnapshot().deadlineCount, 2);
        assert.equal(scheduler.getSnapshot().activeDeadlineCount, 0);
        assert.equal(queue.pendingTaskCount, 0);

        const wakeups = scheduler.getSnapshot().wakeupCount;
        queue.invokeStale(staleTask, 100);
        assert.deepEqual(delivered, ['replace', 'second']);
        assert.equal(scheduler.getSnapshot().wakeupCount, wakeups);
    });

    it('classifies an intentionally retained earlier timeout as causal reconciliation', () => {
        const { queue, scheduler } = createScheduler();
        const delivered: number[] = [];
        scheduler.scheduleDeadline('moving-deadline', 100, () =>
            assert.fail('replaced deadline ran'),
        );
        const retainedTask = queue.peekNextTask();
        scheduler.scheduleDeadline('moving-deadline', 200, ({ nowMs }) =>
            delivered.push(nowMs),
        );

        assert.equal(queue.peekNextTask(), retainedTask);
        queue.runUntil(100);
        let snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.wakeupCount, 1);
        assert.equal(snapshot.productiveWakeupCount, 0);
        assert.equal(snapshot.retainedTimeoutReconciliationWakeupCount, 1);
        assert.equal(snapshot.unexpectedNoWorkWakeupCount, 0);
        assertWakeupClassificationConserved(snapshot);

        queue.runUntil(200);
        snapshot = scheduler.getSnapshot();
        assert.deepEqual(delivered, [200]);
        assert.equal(snapshot.wakeupCount, 2);
        assert.equal(snapshot.productiveWakeupCount, 1);
        assert.equal(snapshot.retainedTimeoutReconciliationWakeupCount, 1);
        assert.equal(snapshot.unexpectedNoWorkWakeupCount, 0);
        assertWakeupClassificationConserved(snapshot);

        scheduler.scheduleDeadline('restored-deadline', 300, () =>
            assert.fail('first restored deadline ran'),
        );
        const restoredTask = queue.peekNextTask();
        scheduler.scheduleDeadline('restored-deadline', 400, () =>
            assert.fail('later restored deadline ran'),
        );
        scheduler.scheduleDeadline('restored-deadline', 300, ({ nowMs }) =>
            delivered.push(nowMs),
        );
        assert.equal(queue.peekNextTask(), restoredTask);

        queue.runUntil(300);
        snapshot = scheduler.getSnapshot();
        assert.deepEqual(delivered, [200, 300]);
        assert.equal(snapshot.wakeupCount, 3);
        assert.equal(snapshot.productiveWakeupCount, 2);
        assert.equal(snapshot.retainedTimeoutReconciliationWakeupCount, 1);
        assert.equal(snapshot.unexpectedNoWorkWakeupCount, 0);
        assertWakeupClassificationConserved(snapshot);
    });

    it('classifies one next-cadence probe for a delayed owned frame receipt', () => {
        const queue = new FakeRuntimeQueue(60);
        const { scheduler } = createScheduler({
            options: { baseFramesPerSecond: 60 },
            queue,
            simulateFrameCallbacks: true,
        });
        queue.runUntil(500);
        while (scheduler.getSnapshot().awaitingFrameReceipt) {
            queue.runNext();
        }
        const start = scheduler.getSnapshot();
        const heldReceipt = holdNextOwnedFrameReceipt(queue, scheduler);
        const cadenceProbeDueAt = scheduler.getSnapshot().pendingCallbackDueAt;
        assert.ok(cadenceProbeDueAt !== null);

        queue.runNext();
        let snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.awaitingFrameReceipt, true);
        assert.equal(snapshot.invalidationCount, start.invalidationCount + 1);
        assert.equal(
            snapshot.pendingFrameReceiptReconciliationWakeupCount -
                start.pendingFrameReceiptReconciliationWakeupCount,
            1,
        );
        assert.equal(
            snapshot.unexpectedNoWorkWakeupCount -
                start.unexpectedNoWorkWakeupCount,
            0,
        );
        assert.equal(
            snapshot.postCalibrationFrameWakeupCount -
                start.postCalibrationFrameWakeupCount,
            0,
        );
        assert.ok(
            (snapshot.pendingCallbackDueAt ?? 0) > cadenceProbeDueAt,
            'The acknowledged cadence probe must arm the bounded receipt retry',
        );
        assertWakeupClassificationConserved(snapshot);

        queue.runTask(heldReceipt);
        snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.awaitingFrameReceipt, false);
        assert.equal(
            snapshot.pendingFrameReceiptReconciliationWakeupCount -
                start.pendingFrameReceiptReconciliationWakeupCount,
            1,
        );
    });

    it('restores receipt metadata after same-due work is cancelled and gives productive work precedence', () => {
        const queue = new FakeRuntimeQueue(60);
        const { scheduler } = createScheduler({
            options: { baseFramesPerSecond: 60 },
            queue,
            simulateFrameCallbacks: true,
        });
        queue.runUntil(500);
        while (scheduler.getSnapshot().awaitingFrameReceipt) {
            queue.runNext();
        }
        const start = scheduler.getSnapshot();
        const firstReceipt = holdNextOwnedFrameReceipt(queue, scheduler);
        const firstProbeTask = queue.peekNextTask();
        assert.ok(firstProbeTask);
        const cancelSameDue = scheduler.scheduleDeadline(
            'cancelled-same-due',
            firstProbeTask.dueAt,
            () => assert.fail('Cancelled same-due deadline ran'),
        );
        assert.equal(queue.peekNextTask(), firstProbeTask);

        cancelSameDue();
        assert.equal(queue.peekNextTask(), firstProbeTask);
        queue.runNext();
        let snapshot = scheduler.getSnapshot();
        assert.equal(
            snapshot.pendingFrameReceiptReconciliationWakeupCount -
                start.pendingFrameReceiptReconciliationWakeupCount,
            1,
        );
        assert.equal(
            snapshot.unexpectedNoWorkWakeupCount -
                start.unexpectedNoWorkWakeupCount,
            0,
        );

        queue.runTask(firstReceipt);
        holdNextOwnedFrameReceipt(queue, scheduler);
        const secondProbeTask = queue.peekNextTask();
        assert.ok(secondProbeTask);
        const delivered: number[] = [];
        scheduler.scheduleDeadline(
            'productive-same-due',
            secondProbeTask.dueAt,
            ({ nowMs }) => delivered.push(nowMs),
        );
        assert.equal(queue.peekNextTask(), secondProbeTask);

        queue.runNext();
        snapshot = scheduler.getSnapshot();
        assert.deepEqual(delivered, [secondProbeTask.dueAt]);
        assert.equal(
            snapshot.productiveWakeupCount - start.productiveWakeupCount,
            3,
        );
        assert.equal(
            snapshot.pendingFrameReceiptReconciliationWakeupCount -
                start.pendingFrameReceiptReconciliationWakeupCount,
            1,
        );
        assert.equal(
            snapshot.unexpectedNoWorkWakeupCount -
                start.unexpectedNoWorkWakeupCount,
            0,
        );
        assertWakeupClassificationConserved(snapshot);
    });

    it('rejects a second cadence probe for the same outstanding receipt generation', () => {
        const queue = new FakeRuntimeQueue(60);
        const { scheduler } = createScheduler({
            options: { baseFramesPerSecond: 60 },
            queue,
            simulateFrameCallbacks: true,
        });
        queue.runUntil(500);
        while (scheduler.getSnapshot().awaitingFrameReceipt) {
            queue.runNext();
        }
        const start = scheduler.getSnapshot();
        holdNextOwnedFrameReceipt(queue, scheduler);

        queue.runNext();
        scheduler.setBaseFramesPerSecond(30);
        queue.runNext();

        const snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.awaitingFrameReceipt, true);
        assert.equal(
            snapshot.pendingFrameReceiptReconciliationWakeupCount -
                start.pendingFrameReceiptReconciliationWakeupCount,
            1,
        );
        assert.equal(
            snapshot.unexpectedNoWorkWakeupCount -
                start.unexpectedNoWorkWakeupCount,
            1,
        );
        assertWakeupClassificationConserved(snapshot);
    });

    it('allows one new cadence probe after a receipt retry creates a new generation', () => {
        const queue = new FakeRuntimeQueue(60);
        const { scheduler } = createScheduler({
            options: { baseFramesPerSecond: 60 },
            queue,
            simulateFrameCallbacks: true,
        });
        queue.runUntil(500);
        while (scheduler.getSnapshot().awaitingFrameReceipt) {
            queue.runNext();
        }
        const start = scheduler.getSnapshot();
        holdNextOwnedFrameReceipt(queue, scheduler);

        queue.runNext();
        queue.runNext();
        let snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.missedFrameReceiptCount, 1);
        assert.equal(snapshot.invalidationCount, start.invalidationCount + 2);
        assert.equal(
            snapshot.pendingFrameReceiptReconciliationWakeupCount -
                start.pendingFrameReceiptReconciliationWakeupCount,
            1,
        );

        queue.runNext();
        snapshot = scheduler.getSnapshot();
        assert.equal(
            snapshot.pendingFrameReceiptReconciliationWakeupCount -
                start.pendingFrameReceiptReconciliationWakeupCount,
            2,
        );
        assert.equal(
            snapshot.unexpectedNoWorkWakeupCount -
                start.unexpectedNoWorkWakeupCount,
            0,
        );
        assertWakeupClassificationConserved(snapshot);
    });

    it('rounds a fractional timeout upward before browser long conversion', () => {
        const queue = new FakeRuntimeQueue();
        queue.browserLongTimeoutDelays = true;
        const { scheduler } = createScheduler({ queue });
        const delivered: number[] = [];

        scheduler.scheduleDeadline('fractional-deadline', 100.75, ({ nowMs }) =>
            delivered.push(nowMs),
        );

        assert.equal(queue.peekNextTask()?.dueAt, 101);
        assert.equal(scheduler.getSnapshot().pendingCallbackDueAt, 100.75);
        queue.runUntil(101);

        const snapshot = scheduler.getSnapshot();
        assert.deepEqual(delivered, [101]);
        assert.equal(snapshot.wakeupCount, 1);
        assert.equal(snapshot.productiveWakeupCount, 1);
        assert.equal(snapshot.retainedTimeoutReconciliationWakeupCount, 0);
        assert.equal(snapshot.unexpectedNoWorkWakeupCount, 0);
        assertWakeupClassificationConserved(snapshot);
    });

    it('fails closed if a browser timeout fires before its semantic due time', () => {
        const queue = new FakeRuntimeQueue();
        queue.browserLongTimeoutDelays = true;
        const { scheduler } = createScheduler({ queue });
        const delivered: number[] = [];

        scheduler.scheduleDeadline('early-deadline', 100.75, ({ nowMs }) =>
            delivered.push(nowMs),
        );
        queue.runNext(100.5);

        let snapshot = scheduler.getSnapshot();
        assert.deepEqual(delivered, []);
        assert.equal(snapshot.wakeupCount, 1);
        assert.equal(snapshot.productiveWakeupCount, 0);
        assert.equal(snapshot.retainedTimeoutReconciliationWakeupCount, 0);
        assert.equal(snapshot.unexpectedNoWorkWakeupCount, 1);
        assert.equal(snapshot.pendingCallbackDueAt, 100.75);
        assertWakeupClassificationConserved(snapshot);

        queue.runNext();
        snapshot = scheduler.getSnapshot();
        assert.deepEqual(delivered, [101.5]);
        assert.equal(snapshot.wakeupCount, 2);
        assert.equal(snapshot.productiveWakeupCount, 1);
        assert.equal(snapshot.retainedTimeoutReconciliationWakeupCount, 0);
        assert.equal(snapshot.unexpectedNoWorkWakeupCount, 1);
        assertWakeupClassificationConserved(snapshot);
    });

    it('chunks a deadline beyond the maximum browser timeout', () => {
        const maximumBrowserTimeoutMs = 2_147_483_647;
        const queue = new FakeRuntimeQueue();
        queue.browserLongTimeoutDelays = true;
        const { scheduler } = createScheduler({ queue });
        const delivered: number[] = [];
        scheduler.scheduleDeadline(
            'long-deadline',
            maximumBrowserTimeoutMs + 1_000,
            ({ nowMs }) => delivered.push(nowMs),
        );

        assert.equal(queue.peekNextTask()?.dueAt, maximumBrowserTimeoutMs);
        assert.equal(
            scheduler.getSnapshot().pendingCallbackDueAt,
            maximumBrowserTimeoutMs,
        );
        queue.runNext();
        let snapshot = scheduler.getSnapshot();
        assert.deepEqual(delivered, []);
        assert.equal(snapshot.wakeupCount, 1);
        assert.equal(snapshot.productiveWakeupCount, 0);
        assert.equal(snapshot.retainedTimeoutReconciliationWakeupCount, 1);
        assert.equal(snapshot.unexpectedNoWorkWakeupCount, 0);
        assert.equal(
            queue.peekNextTask()?.dueAt,
            maximumBrowserTimeoutMs + 1_000,
        );
        assertWakeupClassificationConserved(snapshot);

        queue.runNext();
        snapshot = scheduler.getSnapshot();
        assert.deepEqual(delivered, [maximumBrowserTimeoutMs + 1_000]);
        assert.equal(snapshot.wakeupCount, 2);
        assert.equal(snapshot.productiveWakeupCount, 1);
        assert.equal(snapshot.retainedTimeoutReconciliationWakeupCount, 1);
        assert.equal(snapshot.unexpectedNoWorkWakeupCount, 0);
        assertWakeupClassificationConserved(snapshot);
    });

    it('never owns more than one callback and ignores a cancelled stale timer', () => {
        const { invalidations, queue, scheduler } = createScheduler();
        const release = scheduler.acquireRenderLease('plant', 20);
        const staleRenderTimer = queue.peekNextTask();
        assert.ok(staleRenderTimer);

        release();
        scheduler.scheduleDeadlineAfter('retry', 2, () => undefined);
        assert.equal(queue.pendingTaskCount, 1);
        assert.equal(queue.peekNextTask()?.kind, 'timeout');
        const invalidationCount = invalidations.length;
        queue.invokeStale(staleRenderTimer, 1);

        assert.equal(invalidations.length, invalidationCount);
        assert.equal(queue.pendingTaskCount, 1);
        assert.equal(queue.maximumPendingTaskCount, 1);
    });

    it('services deadlines and fixed steps at their earliest due time during rendering', () => {
        const { queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });
        const deadlines: Array<{
            latenessMs: number;
            nowMs: number;
            scheduledForMs: number;
        }> = [];
        const fixedSteps: number[] = [];
        const releaseRender = scheduler.acquireRenderLease('weather', 30);
        const releaseFixed = scheduler.acquireFixedStepLease('weather-step', {
            callback: ({ nowMs }) => fixedSteps.push(nowMs),
            stepsPerSecond: 20,
        });
        scheduler.scheduleDeadline('weather-deadline', 25, (deadline) =>
            deadlines.push(deadline),
        );

        queue.runUntil(60);

        assert.equal(deadlines.length, 1);
        assertNear(deadlines[0]?.scheduledForMs ?? 0, 25);
        assert.ok((deadlines[0]?.nowMs ?? 0) >= 25);
        assert.ok((deadlines[0]?.nowMs ?? Infinity) < 26);
        assert.ok((deadlines[0]?.latenessMs ?? -1) >= 0);
        assert.ok((deadlines[0]?.latenessMs ?? Infinity) < 1);
        assert.equal(fixedSteps.length, 1);
        assert.ok((fixedSteps[0] ?? 0) >= 50);
        assert.ok((fixedSteps[0] ?? Infinity) < 51);
        assert.equal(
            queue.taskHistory.some((task) => task.source === 'timeout'),
            true,
        );
        queue.runUntil(1_000);
        assert.equal(scheduler.getSnapshot().displayFrameCalibrationCount, 1);
        assert.equal(scheduler.getSnapshot().pendingCallbackKind, 'timeout');

        releaseFixed();
        releaseRender();
    });

    it('reconciles remaining work when a delivered callback throws', () => {
        const { queue, scheduler } = createScheduler();
        scheduler.scheduleDeadlineAfter('throws', 0, () => {
            throw new Error('deadline failed');
        });
        assert.throws(() => queue.runNext(), /deadline failed/);
        assert.equal(queue.pendingTaskCount, 0);
        assert.equal(scheduler.getSnapshot().productiveWakeupCount, 1);
        assertWakeupClassificationConserved(scheduler.getSnapshot());

        const release = scheduler.acquireFixedStepLease('throws-fixed', {
            callback: () => {
                throw new Error('fixed step failed');
            },
            stepsPerSecond: 1,
        });
        assert.throws(() => queue.runNext(), /fixed step failed/);
        assert.equal(queue.pendingTaskCount, 0);
        assert.equal(scheduler.getSnapshot().activeFixedStepLeaseCount, 0);
        assert.equal(scheduler.getSnapshot().fixedStepFailureCount, 1);
        assert.equal(scheduler.getSnapshot().productiveWakeupCount, 2);
        assert.equal(scheduler.getSnapshot().unexpectedNoWorkWakeupCount, 0);
        assertWakeupClassificationConserved(scheduler.getSnapshot());
        release();
    });

    it('backs off a failed invalidation instead of retrying at zero delay', () => {
        const { queue, scheduler } = createScheduler({
            options: {
                baseFramesPerSecond: 30,
                invalidate: () => {
                    throw new Error('invalidation failed');
                },
            },
        });

        assert.throws(() => queue.runNext(), /invalidation failed/);
        assert.equal(scheduler.getSnapshot().invalidationFailureCount, 1);
        assert.equal(scheduler.getSnapshot().productiveWakeupCount, 0);
        assert.equal(
            scheduler.getSnapshot().retainedTimeoutReconciliationWakeupCount,
            0,
        );
        assert.equal(scheduler.getSnapshot().unexpectedNoWorkWakeupCount, 1);
        assertWakeupClassificationConserved(scheduler.getSnapshot());
        assert.equal(queue.pendingTaskCount, 1);
        assert.equal(scheduler.getSnapshot().pendingCallbackKind, 'frame');
        assert.equal(scheduler.getSnapshot().pendingCallbackDueAt, null);

        queue.runUntil(110);
        assert.equal(scheduler.getSnapshot().invalidationFailureCount, 1);
        assert.throws(
            () => queue.runUntil(130),
            /invalidation failed/,
            'A failed invalidation must retry after its bounded backoff',
        );
        assert.equal(scheduler.getSnapshot().invalidationFailureCount, 2);
        assert.equal(scheduler.getSnapshot().missedFrameReceiptCount, 0);
    });

    for (const requestedFrames of [1, 2] as const) {
        it(`retains a ${requestedFrames}-frame semantic request until R3F acknowledges it`, () => {
            const { invalidations, queue, scheduler } = createScheduler();
            scheduler.requestRender('semantic-retry', requestedFrames);

            queue.runNext();
            assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, [
                'semantic-retry',
            ]);
            queue.runUntil(120);
            assert.equal(scheduler.getSnapshot().missedFrameReceiptCount, 1);
            assert.equal(invalidations.length, 2);
            assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, [
                'semantic-retry',
            ]);

            scheduler.recordFrameCallback();
            assert.deepEqual(
                scheduler.getSnapshot().renderRequestReasons,
                requestedFrames === 1 ? [] : ['semantic-retry'],
            );
        });
    }
});

describe('GameRuntimeScheduler visibility and bounded work', () => {
    it('does not let a hidden late receipt consume deferred render work', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });
        scheduler.requestRender('deferred-external', 2);
        scheduler.setDocumentVisible(false);
        const hiddenWorkBefore =
            scheduler.getSnapshot().nonessentialHiddenWorkCount;

        scheduler.recordFrameCallback(queue.currentTime);

        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, [
            'deferred-external',
        ]);
        assert.equal(
            scheduler.getSnapshot().nonessentialHiddenWorkCount,
            hiddenWorkBefore + 1,
        );
        assert.equal(invalidations.length, 0);
        assert.equal(queue.pendingTaskCount, 0);

        scheduler.setDocumentVisible(true);
        queue.runUntil(40);
        assert.equal(invalidations.length, 1);
        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, []);
    });

    it('publishes effective visibility changes and disposal', () => {
        const { scheduler } = createScheduler();
        const visibility: boolean[] = [];
        const unsubscribe = scheduler.subscribeVisibility((visible) => {
            visibility.push(visible);
        });

        scheduler.setCanvasVisible(false);
        scheduler.setDocumentVisible(false);
        scheduler.setCanvasVisible(true);
        scheduler.setDocumentVisible(true);
        scheduler.dispose();
        unsubscribe();

        assert.deepEqual(visibility, [true, false, true, false]);
        assert.equal(scheduler.getEffectiveVisibility(), false);
    });

    it('combines document, canvas, context, and offscreen-capture policy gates', () => {
        const { invalidations, queue, scheduler } = createScheduler();
        const release = scheduler.acquireRenderLease('weather', 30);
        let resumes = 0;
        scheduler.subscribeResume(() => {
            resumes += 1;
        });

        scheduler.setDocumentVisible(false);
        scheduler.setCanvasVisible(false);
        scheduler.setContextAvailable(false);
        scheduler.requestRender('hidden-update');
        assert.equal(queue.pendingTaskCount, 0);

        scheduler.setDocumentVisible(true);
        scheduler.setVisibility({ requireCanvasVisible: false });
        assert.equal(scheduler.getSnapshot().effectiveVisible, false);
        scheduler.setContextAvailable(true);
        assert.equal(scheduler.getSnapshot().canvasVisible, false);
        assert.equal(scheduler.getSnapshot().effectiveVisible, true);
        assert.equal(queue.pendingTaskCount, 1);
        queue.runNext();
        assert.equal(invalidations.length, 1);

        scheduler.setVisibility({ requireCanvasVisible: true });
        assert.equal(scheduler.getSnapshot().effectiveVisible, false);
        scheduler.setCanvasVisible(true);
        assert.equal(scheduler.getSnapshot().effectiveVisible, true);
        assert.equal(resumes, 2);

        const snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.suspendCount, 2);
        assert.equal(snapshot.resumeCount, 2);
        assert.ok(snapshot.nonessentialHiddenWorkCount >= 1);
        assert.equal(snapshot.hiddenDeferredRenderRequestCount, 1);
        release();
    });

    it('bounds fixed-step deltas and emits no catch-up burst after a stall', () => {
        const { queue, scheduler } = createScheduler();
        const steps: Array<{ deltaMs: number; nowMs: number }> = [];
        const release = scheduler.acquireFixedStepLease('animal-ai', {
            callback: ({ deltaMs, nowMs }) => steps.push({ deltaMs, nowMs }),
            maxDeltaMs: 40,
            stepsPerSecond: 20,
        });
        const delayedTask = queue.peekNextTask();
        assert.ok(delayedTask);

        queue.runNext(1_000);
        assert.deepEqual(steps, [{ deltaMs: 40, nowMs: 1_000 }]);
        assertNear(queue.peekNextTask()?.dueAt ?? 0, 1_050);
        assert.equal(scheduler.getSnapshot().fixedStepCount, 1);
        assert.equal(scheduler.getSnapshot().maxDeliveredDeltaMs, 40);
        assert.ok(scheduler.getSnapshot().deferredWorkCount >= 19);

        release();
        assert.equal(queue.pendingTaskCount, 0);
    });

    for (const stepsPerSecond of [1, 5] as const) {
        it(`delivers an on-time ${stepsPerSecond} Hz fixed step without default clamping`, () => {
            const { queue, scheduler } = createScheduler();
            const deltas: number[] = [];
            const release = scheduler.acquireFixedStepLease('slow-work', {
                callback: ({ deltaMs }) => deltas.push(deltaMs),
                stepsPerSecond,
            });

            queue.runNext();
            assert.deepEqual(deltas, [1000 / stepsPerSecond]);
            release();
        });
    }

    it('resets fixed-step time on resume instead of delivering hidden elapsed time', () => {
        const { queue, scheduler } = createScheduler();
        const deltas: number[] = [];
        const release = scheduler.acquireFixedStepLease('game-time', {
            callback: ({ deltaMs }) => deltas.push(deltaMs),
            stepsPerSecond: 10,
        });

        scheduler.setDocumentVisible(false);
        queue.runUntil(10_000);
        scheduler.setDocumentVisible(true);
        queue.runUntil(10_100);
        assert.equal(deltas.length, 1);
        assertNear(deltas[0] ?? 0, 100);

        release();
    });

    it('coalesces queued multi-frame work to one frame across suspension', () => {
        const { invalidations, queue, scheduler } = createScheduler({
            simulateFrameCallbacks: true,
        });

        scheduler.requestRender('transition', 60);
        scheduler.setDocumentVisible(false);
        assert.equal(queue.pendingTaskCount, 0);
        scheduler.requestRender('hidden-transition', 60);

        queue.runUntil(300_000);
        scheduler.setDocumentVisible(true);
        queue.runUntil(301_000);

        assert.equal(invalidations.length, 1);
        assertNear(invalidations[0] ?? 0, 300_000 + 1000 / 60);
        assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, []);
        assert.equal(queue.pendingTaskCount, 0);
    });
});

describe('GameRuntimeScheduler lifecycle and telemetry', () => {
    it('survives overlapping StrictMode-style acquire and release lifecycles', () => {
        const { scheduler } = createScheduler();
        const releaseFirst = scheduler.acquireRenderLease('strict-effect', 30);
        const releaseSecond = scheduler.acquireRenderLease('strict-effect', 30);

        releaseFirst();
        assert.equal(scheduler.getSnapshot().activeRenderLeaseCount, 1);
        assert.deepEqual(scheduler.getSnapshot().renderLeaseOwners, [
            'strict-effect',
        ]);
        releaseFirst();
        releaseSecond();
        assert.equal(scheduler.getSnapshot().activeRenderLeaseCount, 0);
        assert.equal(scheduler.getSnapshot().leaseReleasedCount, 2);
    });

    it('reports stable owner and callback telemetry with frame receipts separated', () => {
        const snapshots: GameRuntimeSchedulerSnapshot[] = [];
        const { queue, scheduler } = createScheduler({ snapshots });
        const releaseRender = scheduler.acquireRenderLease('z-weather', 30);
        const releaseFixed = scheduler.acquireFixedStepLease('a-clock', {
            callback: () => undefined,
            stepsPerSecond: 10,
        });
        scheduler.scheduleDeadlineAfter('m-retry', 200, () => undefined);

        assert.deepEqual(scheduler.getSnapshot().renderLeaseOwners, [
            'z-weather',
        ]);
        assert.deepEqual(scheduler.getSnapshot().fixedStepOwners, ['a-clock']);
        assert.deepEqual(scheduler.getSnapshot().deadlineOwners, ['m-retry']);
        assert.equal(scheduler.getSnapshot().loopActive, true);
        queue.runNext();

        let snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.ownedInvalidationCount, 1);
        assert.equal(snapshot.invalidationCount, 1);
        assert.equal(snapshot.r3fFrameCallbackCount, 0);
        scheduler.recordFrameCallback();
        snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.r3fFrameCallbackCount, 1);
        assert.ok(snapshot.scheduledCallbackCount >= 2);
        assert.equal(snapshot.wakeupCount, 1);
        assert.ok(snapshots.length >= 5);

        releaseRender();
        releaseFixed();
    });

    it('enables profile snapshots without permanent per-frame observation', () => {
        const { scheduler } = createScheduler();
        const snapshots: GameRuntimeSchedulerSnapshot[] = [];

        scheduler.setSnapshotListener((snapshot) => snapshots.push(snapshot));
        assert.equal(snapshots.length, 1);
        scheduler.recordFrameCallback();
        assert.equal(snapshots.length, 2);

        scheduler.setSnapshotListener(undefined);
        scheduler.recordFrameCallback();
        assert.equal(snapshots.length, 2);
        assert.equal(scheduler.getSnapshot().r3fFrameCallbackCount, 2);
    });

    it('disposes once, cancels pending work, and makes old releases inert', () => {
        const { invalidations, queue, scheduler } = createScheduler();
        const releaseRender = scheduler.acquireRenderLease('weather', 30);
        const releaseFixed = scheduler.acquireFixedStepLease('clock', {
            callback: () => assert.fail('disposed fixed step ran'),
            stepsPerSecond: 10,
        });
        scheduler.scheduleDeadlineAfter('retry', 10, () =>
            assert.fail('disposed deadline ran'),
        );
        scheduler.requestCoalescedRender('r3f-host', 3);
        const staleTask = queue.peekNextTask();
        assert.ok(staleTask);

        scheduler.dispose();
        scheduler.dispose();
        releaseRender();
        releaseFixed();
        scheduler.acquireRenderLease('post-dispose', 60);
        scheduler.acquireFixedStepLease('post-dispose', {
            callback: () => assert.fail('post-dispose fixed step ran'),
            stepsPerSecond: 60,
        });
        scheduler.scheduleDeadlineAfter('post-dispose', 0, () =>
            assert.fail('post-dispose deadline ran'),
        );
        queue.invokeStale(staleTask, 100);
        scheduler.requestRender('disposed');
        assert.equal(scheduler.requestCoalescedRender('disposed', 3), false);
        scheduler.recordFrameCallback();

        const snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.disposed, true);
        assert.equal(snapshot.awaitingFrameReceipt, false);
        assert.equal(snapshot.activeRenderLeaseCount, 0);
        assert.equal(snapshot.activeFixedStepLeaseCount, 0);
        assert.equal(snapshot.activeDeadlineCount, 0);
        assert.equal(snapshot.callbackPending, false);
        assert.equal(snapshot.leaseAcquiredCount, 2);
        assert.equal(snapshot.leaseReleasedCount, 2);
        assert.deepEqual(snapshot.coalescedRenderRequestReasons, []);
        assert.deepEqual(snapshot.renderRequestReasons, []);
        assert.deepEqual(invalidations, []);
        assert.equal(queue.pendingTaskCount, 0);
    });
});
