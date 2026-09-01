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
    dueAt: number;
    frameTimestamp?: number;
    id: number;
    kind: 'frame' | 'timeout';
};

class FakeRuntimeQueue {
    currentTime = 0;
    maximumPendingTaskCount = 0;
    readonly scheduledKinds: FakeTask['kind'][] = [];
    readonly tasks = new Map<number, FakeTask>();
    readonly taskHistory: FakeTask[] = [];
    private displayFrameIntervalIndex = 0;
    private variableDisplayFrameAt = 0;
    private nextTaskId = 1;

    constructor(
        public displayFramesPerSecond = 60,
        private readonly frameStepCounts: number[] = [],
        private readonly frameCallbackDelaysMs: number[] = [],
        private readonly displayFrameIntervalsMs: readonly number[] = [],
    ) {}

    readonly now = () => this.currentTime;

    readonly setTimeout = (callback: () => void, delayMs: number) =>
        this.schedule('timeout', callback, this.currentTime + delayMs);

    readonly requestFrame = (callback: (timestamp?: number) => void) => {
        const frameIntervalMs = 1000 / this.displayFramesPerSecond;
        const frameStepCount = Math.max(
            1,
            Math.floor(this.frameStepCounts.shift() ?? 1),
        );
        let frameTimestamp: number;
        if (this.displayFrameIntervalsMs.length > 0) {
            while (
                this.variableDisplayFrameAt <=
                this.currentTime + timingToleranceMs
            ) {
                this.advanceVariableDisplayFrame(frameIntervalMs);
            }
            for (let step = 1; step < frameStepCount; step += 1) {
                this.advanceVariableDisplayFrame(frameIntervalMs);
            }
            frameTimestamp = this.variableDisplayFrameAt;
        } else {
            const currentFrameNumber = Math.floor(
                this.currentTime / frameIntervalMs + timingToleranceMs,
            );
            frameTimestamp =
                (currentFrameNumber + frameStepCount) * frameIntervalMs;
        }
        const callbackDelayMs = Math.max(
            0,
            this.frameCallbackDelaysMs.shift() ?? 0,
        );
        return this.schedule(
            'frame',
            callback,
            frameTimestamp + callbackDelayMs,
            frameTimestamp,
        );
    };

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
        this.tasks.delete(task.id);
        this.currentTime = Math.max(this.currentTime, atTime ?? task.dueAt);
        task.callback(task.frameTimestamp);
        return task;
    }

    runUntil(targetTime: number, maximumCallbacks = 1_000) {
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
        this.variableDisplayFrameAt += intervalMs;
    }

    private schedule(
        kind: FakeTask['kind'],
        callback: (timestamp?: number) => void,
        dueAt: number,
        frameTimestamp?: number,
    ) {
        const task: FakeTask = {
            callback,
            dueAt,
            frameTimestamp,
            id: this.nextTaskId++,
            kind,
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
    let scheduler: GameRuntimeScheduler;
    const requestExternalFrame = () => {
        if (!simulateFrameCallbacks || framePending) {
            return;
        }
        framePending = true;
        queue.requestFrame((displayTimestamp) => {
            framePending = false;
            frameCallbackTimes.push(displayTimestamp ?? queue.currentTime);
            scheduler.recordFrameCallback(displayTimestamp);
        });
    };
    scheduler = new GameRuntimeScheduler({
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
            clearTimeout: queue.clearTimeout,
            invalidate: () => assert.fail('idle scheduler invalidated'),
            now: queue.now,
            onSnapshot: (snapshot) => snapshots.push(snapshot),
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

            queue.runUntil(350);
            const steadyFrameCallbackTimes = frameCallbackTimes.slice(8);
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
                scheduler.getSnapshot().wakeupCount <= invalidations.length,
            );

            release();
            assert.equal(queue.pendingTaskCount, 0);
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
                assert.equal(
                    snapshot.invalidationCount - snapshot.wakeupCount,
                    7,
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
            assert.equal(
                snapshot.invalidationCount - snapshot.wakeupCount,
                7,
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
        const directCalibrationInvalidationCount =
            firstSnapshot.invalidationCount - firstSnapshot.wakeupCount;
        assert.equal(firstSnapshot.displayFrameCalibrationCount, 1);
        assertNear(firstSnapshot.displayFrameIntervalMs ?? 0, 1000 / 60);
        assert.ok(directCalibrationInvalidationCount <= 12);

        queue.runUntil(5_000);
        const finalSnapshot = scheduler.getSnapshot();
        assert.equal(finalSnapshot.displayFrameCalibrationCount, 1);
        assert.equal(
            finalSnapshot.invalidationCount - finalSnapshot.wakeupCount,
            directCalibrationInvalidationCount,
            'Fallback calibration must not leave a permanent direct-frame loop',
        );
        release();
    });

    it('does not push the absolute cadence target forward for every external frame', () => {
        const queue = new FakeRuntimeQueue(60);
        const { invalidations, requestExternalFrame, scheduler } =
            createScheduler({
                queue,
                simulateFrameCallbacks: true,
            });
        const release = scheduler.acquireRenderLease('external-burst', 30);
        queue.runUntil(500);
        const invalidationsBeforeBurst = invalidations.length;

        for (let frame = 1; frame <= 12; frame += 1) {
            requestExternalFrame();
            queue.runUntil(500 + frame * (1000 / 60));
        }
        const invalidationsAfterBurst = invalidations.length;
        assert.ok(
            invalidationsAfterBurst - invalidationsBeforeBurst <= 7,
            'A same-refresh external burst must not restart calibration',
        );
        queue.runUntil(1_200);

        assert.ok(invalidations.length >= invalidationsAfterBurst + 10);
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

        queue.runUntil(40);
        assert.equal(invalidations.length, 2);
        assertNear(invalidations[0] ?? -1, 0);
        assertNear(invalidations[1] ?? 0, 1000 / 60);
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

    it('reconciles remaining work when a delivered callback throws', () => {
        const { queue, scheduler } = createScheduler();
        scheduler.scheduleDeadlineAfter('throws', 0, () => {
            throw new Error('deadline failed');
        });
        assert.throws(() => queue.runNext(), /deadline failed/);
        assert.equal(queue.pendingTaskCount, 0);

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
        assert.equal(queue.pendingTaskCount, 1);
        assertNear(queue.peekNextTask()?.dueAt ?? 0, 100);
    });

    for (const requestedFrames of [1, 2] as const) {
        it(`retains a ${requestedFrames}-frame semantic request until R3F acknowledges it`, () => {
            const { invalidations, queue, scheduler } = createScheduler();
            scheduler.requestRender('semantic-retry', requestedFrames);

            queue.runNext();
            assert.deepEqual(scheduler.getSnapshot().renderRequestReasons, [
                'semantic-retry',
            ]);
            queue.runNext();
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

        assert.deepEqual(invalidations, [300_000]);
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
        scheduler.recordFrameCallback();

        const snapshot = scheduler.getSnapshot();
        assert.equal(snapshot.disposed, true);
        assert.equal(snapshot.activeRenderLeaseCount, 0);
        assert.equal(snapshot.activeFixedStepLeaseCount, 0);
        assert.equal(snapshot.activeDeadlineCount, 0);
        assert.equal(snapshot.callbackPending, false);
        assert.equal(snapshot.leaseAcquiredCount, 2);
        assert.equal(snapshot.leaseReleasedCount, 2);
        assert.deepEqual(invalidations, []);
        assert.equal(queue.pendingTaskCount, 0);
    });
});
