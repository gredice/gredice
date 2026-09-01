import {
    normalizeSceneFramesPerSecond,
    resolveSceneFramesPerSecond,
} from './sceneFrameScheduler';

const defaultAmbientFramesPerSecond = 30;
const defaultMaximumDeliveredDeltaMs = 100;
const defaultDisplayFrameIntervalMs = 1000 / 60;
const displayFrameCalibrationSampleCount = 7;
const maximumDisplayFrameCalibrationAttempts = 12;
const maximumDisplayFrameCalibrationDurationMs = 750;
const schedulerToleranceMs = 0.5;
const maximumTimeoutMs = 2_147_483_647;
const maximumRequestedFrames = 60;

type SchedulerHandle = unknown;

export type GameRuntimeSchedulerPendingCallback = 'frame' | 'none' | 'timeout';

export type GameRuntimeSchedulerVisibility = {
    canvasVisible: boolean;
    contextAvailable: boolean;
    documentVisible: boolean;
    requireCanvasVisible: boolean;
};

export type GameRuntimeSchedulerSnapshot = GameRuntimeSchedulerVisibility & {
    activeDeadlineCount: number;
    activeFixedStepLeaseCount: number;
    activeLeaseCount: number;
    activeRenderLeaseCount: number;
    callbackPending: boolean;
    cancelledCallbackCount: number;
    coalescedRenderRequestReasons: readonly string[];
    deadlineCount: number;
    deadlineOwners: readonly string[];
    deferredWorkCount: number;
    displayFrameCalibrationCount: number;
    /** Observational bounded calibration; this value never steers scheduling. */
    displayFrameIntervalMs: number | null;
    disposed: boolean;
    effectiveVisible: boolean;
    fixedStepCount: number;
    fixedStepFailureCount: number;
    fixedStepOwners: readonly string[];
    hiddenCoalescedRenderRequestCount: number;
    hiddenDeferredCoalescedRenderRequestCount: number;
    hiddenDeferredRenderRequestCount: number;
    invalidationCount: number;
    invalidationFailureCount: number;
    leaseAcquiredCount: number;
    leaseReleasedCount: number;
    loopActive: boolean;
    maxDeliveredDeltaMs: number;
    missedFrameReceiptCount: number;
    nonessentialHiddenWorkCount: number;
    ownedInvalidationCount: number;
    pendingCallbackDueAt: number | null;
    pendingCallbackKind: GameRuntimeSchedulerPendingCallback;
    renderLeaseOwners: readonly string[];
    renderLeaseSummaries: readonly GameRuntimeRenderLeaseSummary[];
    renderRequestReasons: readonly string[];
    resumeCount: number;
    scheduledCallbackCount: number;
    r3fFrameCallbackCount: number;
    suspendCount: number;
    targetFramesPerSecond: number;
    wakeupCount: number;
};

export type GameRuntimeSchedulerOptions = {
    /** Fallback cadence for a render lease that does not name a rate. */
    ambientFramesPerSecond?: number;
    /** Always-on cadence. Keep this at zero once every visual owner has a lease. */
    baseFramesPerSecond?: number;
    cancelFrame: (handle: SchedulerHandle) => void;
    clearTimeout: (handle: SchedulerHandle) => void;
    initialVisibility?: Partial<GameRuntimeSchedulerVisibility>;
    invalidate: () => void;
    maxDeliveredDeltaMs?: number;
    now: () => number;
    onSnapshot?: (snapshot: GameRuntimeSchedulerSnapshot) => void;
    requestFrame: (
        callback: (displayTimestampMs?: number) => void,
    ) => SchedulerHandle;
    setTimeout: (callback: () => void, delayMs: number) => SchedulerHandle;
};

export type GameRuntimeRenderLeaseSummary = {
    framesPerSecond: number;
    leaseCount: number;
    owner: string;
};

export type GameRuntimeSchedulerFrequentProfileSnapshot = Pick<
    GameRuntimeSchedulerSnapshot,
    'activeLeaseCount' | 'activeRenderLeaseCount' | 'targetFramesPerSecond'
>;

export type GameRuntimeFixedStep = {
    deltaMs: number;
    nowMs: number;
    owner: string;
};

export type GameRuntimeFixedStepLeaseOptions = {
    callback: (step: GameRuntimeFixedStep) => void;
    maxDeltaMs?: number;
    stepsPerSecond: number;
};

export type GameRuntimeDeadline = {
    latenessMs: number;
    nowMs: number;
    owner: string;
    scheduledForMs: number;
};

type RenderLease = {
    framesPerSecond: number | undefined;
    owner: string;
};

type SharedRenderLease = {
    leaseCount: number;
    release: () => void;
};

type FixedStepLease = {
    callback: (step: GameRuntimeFixedStep) => void;
    intervalMs: number;
    lastDeliveredAt: number;
    maxDeltaMs: number;
    nextDueAt: number;
    owner: string;
};

type DeadlineEntry = {
    callback: (deadline: GameRuntimeDeadline) => void;
    dueAt: number;
    id: symbol;
    owner: string;
    sequence: number;
};

type PendingCallback = {
    dueAt: number | null;
    handle: SchedulerHandle;
    id: number;
    kind: Exclude<GameRuntimeSchedulerPendingCallback, 'none'>;
};

type NextWakeup = {
    dueAt: number | null;
    kind: Exclude<GameRuntimeSchedulerPendingCallback, 'none'>;
};

type MutableSchedulerCounters = {
    cancelledCallbackCount: number;
    deadlineCount: number;
    deferredWorkCount: number;
    displayFrameCalibrationCount: number;
    fixedStepCount: number;
    fixedStepFailureCount: number;
    hiddenCoalescedRenderRequestCount: number;
    hiddenDeferredCoalescedRenderRequestCount: number;
    hiddenDeferredRenderRequestCount: number;
    invalidationCount: number;
    invalidationFailureCount: number;
    leaseAcquiredCount: number;
    leaseReleasedCount: number;
    maxDeliveredDeltaMs: number;
    missedFrameReceiptCount: number;
    nonessentialHiddenWorkCount: number;
    resumeCount: number;
    scheduledCallbackCount: number;
    r3fFrameCallbackCount: number;
    suspendCount: number;
    wakeupCount: number;
};

function normalizeOwner(owner: string) {
    const normalizedOwner = owner.trim();
    if (normalizedOwner.length === 0) {
        throw new Error('Game runtime scheduler owners must not be empty');
    }
    return normalizedOwner;
}

function normalizePositiveMilliseconds(value: number, fallback: number) {
    if (!Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return value;
}

function normalizeDeadline(value: number, fallback: number) {
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function uniqueSortedOwners(owners: Iterable<string>) {
    return [...new Set(owners)].sort((left, right) =>
        left.localeCompare(right),
    );
}

function median(values: readonly number[]) {
    const sortedValues = [...values].sort((left, right) => left - right);
    return sortedValues[Math.floor(sortedValues.length / 2)] ?? 0;
}

/**
 * Coordinates render submissions and lightweight runtime work without owning
 * DOM, React, or R3F state. Callers provide all clock and scheduling effects so
 * the same core can be used by the browser adapter and deterministic tests.
 */
export class GameRuntimeScheduler {
    private readonly activationListeners = new Set<() => void>();
    private ambientFramesPerSecond: number;
    private baseFramesPerSecond: number;
    private callbackSequence = 0;
    private readonly cancelFrameEffect: (handle: SchedulerHandle) => void;
    private readonly clearTimeoutEffect: (handle: SchedulerHandle) => void;
    private readonly counters: MutableSchedulerCounters = {
        cancelledCallbackCount: 0,
        deadlineCount: 0,
        deferredWorkCount: 0,
        displayFrameCalibrationCount: 0,
        fixedStepCount: 0,
        fixedStepFailureCount: 0,
        hiddenCoalescedRenderRequestCount: 0,
        hiddenDeferredCoalescedRenderRequestCount: 0,
        hiddenDeferredRenderRequestCount: 0,
        invalidationCount: 0,
        invalidationFailureCount: 0,
        leaseAcquiredCount: 0,
        leaseReleasedCount: 0,
        maxDeliveredDeltaMs: 0,
        missedFrameReceiptCount: 0,
        nonessentialHiddenWorkCount: 0,
        resumeCount: 0,
        scheduledCallbackCount: 0,
        r3fFrameCallbackCount: 0,
        suspendCount: 0,
        wakeupCount: 0,
    };
    private deadlineSequence = 0;
    private readonly deadlines = new Map<string, DeadlineEntry>();
    private disposed = false;
    private readonly fixedStepLeases = new Map<symbol, FixedStepLease>();
    private hasBeenEffectivelyVisible: boolean;
    private readonly invalidateEffect: () => void;
    private displayFrameIntervalMs = defaultDisplayFrameIntervalMs;
    private displayFrameCalibrationAttemptCount = 0;
    private displayFrameCalibrationBeganAt: number | null = null;
    private readonly displayFrameCalibrationSamplesMs: number[] = [];
    private frameIntervalCalibrationStartedAt: number | null = null;
    private frameIntervalCalibrated = false;
    private awaitingFrameReceipt = false;
    private invalidationRetryNotBeforeAt: number | null = null;
    private lastInvalidatedAt: number | null = null;
    private lastFrameReceiptAt: number | null = null;
    private nextRenderFrameTargetAt: number | null = null;
    private previousFrameReceiptWasOwned = false;
    private readonly maxDeliveredDeltaMs: number;
    private readonly nowEffect: () => number;
    private onSnapshotEffect:
        | ((snapshot: GameRuntimeSchedulerSnapshot) => void)
        | undefined;
    private pendingCallback: PendingCallback | null = null;
    private readonly coalescedRenderRequests = new Map<string, number>();
    private readonly renderLeases = new Map<symbol, RenderLease>();
    private readonly renderRequests = new Map<string, number>();
    private readonly requestFrameEffect: (
        callback: (displayTimestampMs?: number) => void,
    ) => SchedulerHandle;
    private readonly resumeListeners = new Set<() => void>();
    private readonly sharedRenderLeases = new Map<string, SharedRenderLease>();
    private readonly setTimeoutEffect: (
        callback: () => void,
        delayMs: number,
    ) => SchedulerHandle;
    private targetFramesPerSecond = 0;
    private visibility: GameRuntimeSchedulerVisibility;
    private readonly visibilityListeners = new Set<
        (visible: boolean) => void
    >();

    constructor(options: GameRuntimeSchedulerOptions) {
        this.ambientFramesPerSecond = normalizeSceneFramesPerSecond(
            options.ambientFramesPerSecond ?? defaultAmbientFramesPerSecond,
        );
        this.baseFramesPerSecond = normalizeSceneFramesPerSecond(
            options.baseFramesPerSecond ?? 0,
        );
        this.cancelFrameEffect = options.cancelFrame;
        this.clearTimeoutEffect = options.clearTimeout;
        this.invalidateEffect = options.invalidate;
        this.maxDeliveredDeltaMs = normalizePositiveMilliseconds(
            options.maxDeliveredDeltaMs ?? defaultMaximumDeliveredDeltaMs,
            defaultMaximumDeliveredDeltaMs,
        );
        this.nowEffect = options.now;
        this.onSnapshotEffect = options.onSnapshot;
        this.requestFrameEffect = options.requestFrame;
        this.setTimeoutEffect = options.setTimeout;
        this.refreshTargetFramesPerSecond();
        this.visibility = {
            canvasVisible: options.initialVisibility?.canvasVisible ?? true,
            contextAvailable:
                options.initialVisibility?.contextAvailable ?? true,
            documentVisible:
                options.initialVisibility?.documentVisible ?? false,
            requireCanvasVisible:
                options.initialVisibility?.requireCanvasVisible ?? true,
        };
        this.hasBeenEffectivelyVisible = this.isEffectivelyVisible();

        this.reconcileSchedule();
    }

    acquireRenderLease(owner: string, framesPerSecond?: number) {
        if (this.disposed) {
            return () => undefined;
        }
        const normalizedOwner = normalizeOwner(owner);
        const normalizedFramesPerSecond =
            framesPerSecond === undefined
                ? undefined
                : normalizeSceneFramesPerSecond(framesPerSecond);
        if (normalizedFramesPerSecond === 0) {
            return () => undefined;
        }

        const previousTarget = this.getRenderFramesPerSecond();
        const token = Symbol(normalizedOwner);
        this.renderLeases.set(token, {
            framesPerSecond: normalizedFramesPerSecond,
            owner: normalizedOwner,
        });
        this.refreshTargetFramesPerSecond();
        this.counters.leaseAcquiredCount += 1;
        const nextTarget = this.getRenderFramesPerSecond();
        if (nextTarget !== previousTarget) {
            this.resetRenderFrameTarget(previousTarget);
        }
        if (!this.isEffectivelyVisible()) {
            this.counters.deferredWorkCount += 1;
        }
        this.reconcileSchedule();

        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            const previousReleaseTarget = this.getRenderFramesPerSecond();
            if (!this.renderLeases.delete(token)) {
                return;
            }
            this.refreshTargetFramesPerSecond();
            this.counters.leaseReleasedCount += 1;
            if (this.getRenderFramesPerSecond() !== previousReleaseTarget) {
                this.resetRenderFrameTarget(previousReleaseTarget);
            }
            this.reconcileSchedule();
        };
    }

    acquireSharedRenderLease(owner: string, framesPerSecond?: number) {
        if (this.disposed) {
            return () => undefined;
        }
        const normalizedOwner = normalizeOwner(owner);
        const normalizedFramesPerSecond =
            framesPerSecond === undefined
                ? undefined
                : normalizeSceneFramesPerSecond(framesPerSecond);
        if (normalizedFramesPerSecond === 0) {
            return () => undefined;
        }

        const key = JSON.stringify([
            normalizedOwner,
            normalizedFramesPerSecond ?? null,
        ]);
        let sharedLease = this.sharedRenderLeases.get(key);
        if (sharedLease) {
            sharedLease.leaseCount += 1;
        } else {
            sharedLease = {
                leaseCount: 1,
                release: this.acquireRenderLease(
                    normalizedOwner,
                    normalizedFramesPerSecond,
                ),
            };
            this.sharedRenderLeases.set(key, sharedLease);
        }

        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            const activeLease = this.sharedRenderLeases.get(key);
            if (activeLease !== sharedLease) {
                return;
            }
            activeLease.leaseCount -= 1;
            if (activeLease.leaseCount > 0) {
                return;
            }
            this.sharedRenderLeases.delete(key);
            activeLease.release();
        };
    }

    acquireFixedStepLease(
        owner: string,
        options: GameRuntimeFixedStepLeaseOptions,
    ) {
        if (this.disposed) {
            return () => undefined;
        }
        const normalizedOwner = normalizeOwner(owner);
        const stepsPerSecond = normalizeSceneFramesPerSecond(
            options.stepsPerSecond,
        );
        if (stepsPerSecond === 0) {
            return () => undefined;
        }

        const now = this.readNow();
        const intervalMs = 1000 / stepsPerSecond;
        const token = Symbol(normalizedOwner);
        this.fixedStepLeases.set(token, {
            callback: options.callback,
            intervalMs,
            lastDeliveredAt: now,
            maxDeltaMs:
                options.maxDeltaMs === undefined
                    ? Math.max(this.maxDeliveredDeltaMs, intervalMs)
                    : normalizePositiveMilliseconds(
                          options.maxDeltaMs,
                          Math.max(this.maxDeliveredDeltaMs, intervalMs),
                      ),
            nextDueAt: now + intervalMs,
            owner: normalizedOwner,
        });
        this.counters.leaseAcquiredCount += 1;
        if (!this.isEffectivelyVisible()) {
            this.counters.deferredWorkCount += 1;
        }
        this.reconcileSchedule();

        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            if (!this.fixedStepLeases.delete(token)) {
                return;
            }
            this.counters.leaseReleasedCount += 1;
            this.reconcileSchedule();
        };
    }

    scheduleDeadline(
        owner: string,
        absoluteTimeMs: number,
        callback: (deadline: GameRuntimeDeadline) => void,
    ) {
        if (this.disposed) {
            return () => undefined;
        }
        const normalizedOwner = normalizeOwner(owner);
        const now = this.readNow();
        const id = Symbol(normalizedOwner);
        const entry: DeadlineEntry = {
            callback,
            dueAt: normalizeDeadline(absoluteTimeMs, now),
            id,
            owner: normalizedOwner,
            sequence: this.deadlineSequence++,
        };
        this.deadlines.set(normalizedOwner, entry);
        if (!this.isEffectivelyVisible()) {
            this.counters.deferredWorkCount += 1;
        }
        this.reconcileSchedule();

        let cancelled = false;
        return () => {
            if (cancelled) {
                return;
            }
            cancelled = true;
            if (this.deadlines.get(normalizedOwner)?.id !== id) {
                return;
            }
            this.deadlines.delete(normalizedOwner);
            this.reconcileSchedule();
        };
    }

    scheduleDeadlineAfter(
        owner: string,
        delayMs: number,
        callback: (deadline: GameRuntimeDeadline) => void,
    ) {
        if (this.disposed) {
            return () => undefined;
        }
        const now = this.readNow();
        const normalizedDelayMs = Number.isFinite(delayMs)
            ? Math.max(0, delayMs)
            : 0;
        return this.scheduleDeadline(owner, now + normalizedDelayMs, callback);
    }

    requestRender(reason: string, frames = 1) {
        if (this.disposed || !Number.isFinite(frames) || frames <= 0) {
            return false;
        }

        const previousTarget = this.getRenderFramesPerSecond();
        const normalizedReason = normalizeOwner(reason);
        const requestedFrames = Math.min(
            maximumRequestedFrames,
            Math.max(1, Math.ceil(frames)),
        );
        const previousFrames = this.renderRequests.get(normalizedReason) ?? 0;
        this.renderRequests.set(
            normalizedReason,
            this.isEffectivelyVisible()
                ? Math.max(previousFrames, requestedFrames)
                : 1,
        );
        if (!this.isEffectivelyVisible()) {
            this.counters.hiddenDeferredRenderRequestCount += 1;
            this.recordNonessentialHiddenWork();
        }
        if (this.getRenderFramesPerSecond() !== previousTarget) {
            this.resetRenderFrameTarget(previousTarget);
        }
        this.reconcileSchedule();
        return true;
    }

    /** Retains dirty renderer work without raising an active lease cadence. */
    requestCoalescedRender(reason: string, frames = 1) {
        if (this.disposed || !Number.isFinite(frames) || frames <= 0) {
            return false;
        }

        const effectivelyVisible = this.isEffectivelyVisible();
        const previousTarget = this.getRenderFramesPerSecond();
        const normalizedReason = normalizeOwner(reason);
        const requestedFrames = Math.min(
            maximumRequestedFrames,
            Math.max(1, Math.ceil(frames)),
        );
        const previousFrames =
            this.coalescedRenderRequests.get(normalizedReason) ?? 0;
        const nextFrames = effectivelyVisible
            ? Math.max(previousFrames, requestedFrames)
            : 1;
        if (nextFrames !== previousFrames) {
            this.coalescedRenderRequests.set(normalizedReason, nextFrames);
        }
        if (!effectivelyVisible) {
            this.counters.hiddenCoalescedRenderRequestCount += 1;
            if (previousFrames === 0) {
                this.counters.hiddenDeferredCoalescedRenderRequestCount += 1;
            }
        }
        const nextTarget = this.getRenderFramesPerSecond();
        if (effectivelyVisible && nextTarget !== previousTarget) {
            this.resetRenderFrameTarget(previousTarget);
            this.reconcileSchedule();
        } else {
            // A pending callback already owns the unchanged cadence. Avoid a
            // full schedule resolution for every duplicate R3F host update,
            // while still publishing counter and reason changes to observers.
            this.emitSnapshot();
        }
        return true;
    }

    /** Records one root-scoped R3F render after WebGL submission. */
    recordFrameCallback(displayTimestampMs?: number) {
        if (this.disposed) {
            return;
        }
        this.counters.r3fFrameCallbackCount += 1;
        if (!this.isEffectivelyVisible()) {
            this.counters.nonessentialHiddenWorkCount += 1;
            this.emitSnapshot();
            return;
        }

        const now = this.readNow();
        const displayNow = Number.isFinite(displayTimestampMs)
            ? Math.max(0, displayTimestampMs ?? now)
            : now;
        const ownedFrameReceipt = this.awaitingFrameReceipt;
        if (
            this.renderRequests.size > 0 ||
            this.coalescedRenderRequests.size > 0
        ) {
            const previousTarget = this.getRenderFramesPerSecond();
            for (const [reason, remainingFrames] of this.renderRequests) {
                if (remainingFrames <= 1) {
                    this.renderRequests.delete(reason);
                } else {
                    this.renderRequests.set(reason, remainingFrames - 1);
                }
            }
            for (const [reason, remainingFrames] of this
                .coalescedRenderRequests) {
                if (remainingFrames <= 1) {
                    this.coalescedRenderRequests.delete(reason);
                } else {
                    this.coalescedRenderRequests.set(
                        reason,
                        remainingFrames - 1,
                    );
                }
            }
            if (this.getRenderFramesPerSecond() !== previousTarget) {
                this.resetRenderFrameTarget(previousTarget);
            }
        }
        this.awaitingFrameReceipt = false;
        this.invalidationRetryNotBeforeAt = null;
        if (!ownedFrameReceipt) {
            const receiptAt = Math.max(now, displayNow);
            if (this.isImmediateFollowUpToOwnedFrame(displayNow)) {
                this.consumeRenderFrameTargetAfterExternalReceipt(receiptAt);
            } else {
                this.deferRenderFrameTargetAfterExternalReceipt(receiptAt);
            }
        }
        this.lastFrameReceiptAt = displayNow;
        this.previousFrameReceiptWasOwned = ownedFrameReceipt;
        // Keep an earlier timer in place when an external receipt moves the
        // semantic target later. It can reconcile the new target without a
        // cancellation/rearm pair for every external frame.
        this.reconcileSchedule();
    }

    subscribeResume(listener: () => void) {
        if (this.disposed) {
            return () => undefined;
        }
        this.resumeListeners.add(listener);
        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            this.resumeListeners.delete(listener);
        };
    }

    subscribeActivation(listener: () => void) {
        if (this.disposed) {
            return () => undefined;
        }
        this.activationListeners.add(listener);
        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            this.activationListeners.delete(listener);
        };
    }

    subscribeVisibility(listener: (visible: boolean) => void) {
        if (this.disposed) {
            listener(false);
            return () => undefined;
        }
        this.visibilityListeners.add(listener);
        listener(this.isEffectivelyVisible());
        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            this.visibilityListeners.delete(listener);
        };
    }

    getEffectiveVisibility() {
        return !this.disposed && this.isEffectivelyVisible();
    }

    /**
     * Returns the scalar scheduler state sampled on every profiling RAF.
     * Keep this allocation-free beyond the result object: the full snapshot
     * sorts owners and builds lease summaries, which would make the observer
     * materially alter the CPU profile it is trying to measure.
     */
    getFrequentProfileSnapshot(): GameRuntimeSchedulerFrequentProfileSnapshot {
        const activeRenderLeaseCount = this.renderLeases.size;
        return {
            activeLeaseCount: activeRenderLeaseCount,
            activeRenderLeaseCount,
            targetFramesPerSecond: this.getTargetFramesPerSecond(),
        };
    }

    setSnapshotListener(
        listener:
            | ((snapshot: GameRuntimeSchedulerSnapshot) => void)
            | undefined,
    ) {
        if (this.disposed) {
            return;
        }
        this.onSnapshotEffect = listener;
        this.emitSnapshot();
    }

    setBaseFramesPerSecond(framesPerSecond: number) {
        if (this.disposed) {
            return;
        }
        const previousTarget = this.getRenderFramesPerSecond();
        this.baseFramesPerSecond =
            normalizeSceneFramesPerSecond(framesPerSecond);
        this.refreshTargetFramesPerSecond();
        if (this.getRenderFramesPerSecond() !== previousTarget) {
            this.resetRenderFrameTarget(previousTarget);
        }
        this.reconcileSchedule();
    }

    setAmbientFramesPerSecond(framesPerSecond: number) {
        if (this.disposed) {
            return;
        }
        const previousTarget = this.getRenderFramesPerSecond();
        this.ambientFramesPerSecond =
            normalizeSceneFramesPerSecond(framesPerSecond);
        this.refreshTargetFramesPerSecond();
        if (this.getRenderFramesPerSecond() !== previousTarget) {
            this.resetRenderFrameTarget(previousTarget);
        }
        this.reconcileSchedule();
    }

    setVisibility(visibility: Partial<GameRuntimeSchedulerVisibility>) {
        if (this.disposed) {
            return;
        }
        const wasVisible = this.isEffectivelyVisible();
        this.visibility = {
            canvasVisible:
                visibility.canvasVisible ?? this.visibility.canvasVisible,
            contextAvailable:
                visibility.contextAvailable ?? this.visibility.contextAvailable,
            documentVisible:
                visibility.documentVisible ?? this.visibility.documentVisible,
            requireCanvasVisible:
                visibility.requireCanvasVisible ??
                this.visibility.requireCanvasVisible,
        };
        const isVisible = this.isEffectivelyVisible();
        if (wasVisible === isVisible) {
            this.reconcileSchedule();
            return;
        }

        for (const listener of [...this.visibilityListeners]) {
            listener(isVisible);
        }

        const now = this.readNow();
        this.lastInvalidatedAt = null;
        this.lastFrameReceiptAt = null;
        this.awaitingFrameReceipt = false;
        this.invalidationRetryNotBeforeAt = null;
        this.previousFrameReceiptWasOwned = false;
        this.resetRenderFrameTarget();
        this.displayFrameCalibrationAttemptCount = 0;
        this.displayFrameCalibrationBeganAt = null;
        this.displayFrameCalibrationSamplesMs.length = 0;
        this.frameIntervalCalibrationStartedAt = null;
        this.frameIntervalCalibrated = false;
        if (!isVisible) {
            this.counters.suspendCount += 1;
            if (this.hasOrdinaryActiveWork()) {
                this.counters.deferredWorkCount += 1;
            }
            for (const reason of this.renderRequests.keys()) {
                this.renderRequests.set(reason, 1);
            }
            for (const reason of this.coalescedRenderRequests.keys()) {
                this.coalescedRenderRequests.set(reason, 1);
            }
            this.cancelPendingCallback();
            this.emitSnapshot();
            return;
        }

        const isResume = this.hasBeenEffectivelyVisible;
        this.hasBeenEffectivelyVisible = true;
        for (const lease of this.fixedStepLeases.values()) {
            lease.lastDeliveredAt = now;
            lease.nextDueAt = now + lease.intervalMs;
        }
        if (isResume) {
            this.counters.resumeCount += 1;
        }

        try {
            for (const listener of [...this.activationListeners]) {
                listener();
            }
            if (isResume) {
                for (const listener of [...this.resumeListeners]) {
                    listener();
                }
            }
        } finally {
            this.reconcileSchedule();
        }
    }

    setDocumentVisible(documentVisible: boolean) {
        this.setVisibility({ documentVisible });
    }

    setCanvasVisible(canvasVisible: boolean) {
        this.setVisibility({ canvasVisible });
    }

    setContextAvailable(contextAvailable: boolean) {
        this.setVisibility({ contextAvailable });
    }

    getSnapshot(): GameRuntimeSchedulerSnapshot {
        const pendingCallbackKind = this.pendingCallback?.kind ?? 'none';
        return {
            ...this.visibility,
            ...this.counters,
            activeDeadlineCount: this.deadlines.size,
            activeFixedStepLeaseCount: this.fixedStepLeases.size,
            activeLeaseCount: this.renderLeases.size,
            activeRenderLeaseCount: this.renderLeases.size,
            callbackPending: this.pendingCallback !== null,
            coalescedRenderRequestReasons: uniqueSortedOwners(
                this.coalescedRenderRequests.keys(),
            ),
            deadlineOwners: uniqueSortedOwners(this.deadlines.keys()),
            displayFrameIntervalMs: this.frameIntervalCalibrated
                ? this.displayFrameIntervalMs
                : null,
            disposed: this.disposed,
            effectiveVisible: this.isEffectivelyVisible(),
            fixedStepOwners: uniqueSortedOwners(
                [...this.fixedStepLeases.values()].map((lease) => lease.owner),
            ),
            loopActive: this.isEffectivelyVisible() && this.hasRenderWork(),
            ownedInvalidationCount: this.counters.invalidationCount,
            pendingCallbackDueAt: this.pendingCallback?.dueAt ?? null,
            pendingCallbackKind,
            renderLeaseOwners: uniqueSortedOwners(
                [...this.renderLeases.values()].map((lease) => lease.owner),
            ),
            renderLeaseSummaries: this.getRenderLeaseSummaries(),
            renderRequestReasons: uniqueSortedOwners(
                this.renderRequests.keys(),
            ),
            targetFramesPerSecond: this.getTargetFramesPerSecond(),
        };
    }

    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.cancelPendingCallback();
        this.counters.leaseReleasedCount +=
            this.renderLeases.size + this.fixedStepLeases.size;
        this.deadlines.clear();
        this.fixedStepLeases.clear();
        this.coalescedRenderRequests.clear();
        this.renderLeases.clear();
        this.renderRequests.clear();
        this.sharedRenderLeases.clear();
        this.lastFrameReceiptAt = null;
        this.previousFrameReceiptWasOwned = false;
        this.activationListeners.clear();
        this.resumeListeners.clear();
        for (const listener of [...this.visibilityListeners]) {
            listener(false);
        }
        this.visibilityListeners.clear();
        this.emitSnapshot();
    }

    private readNow() {
        const now = this.nowEffect();
        return Number.isFinite(now) ? Math.max(0, now) : 0;
    }

    private getTargetFramesPerSecond() {
        return this.targetFramesPerSecond;
    }

    private refreshTargetFramesPerSecond() {
        let targetFramesPerSecond = this.baseFramesPerSecond;
        for (const lease of this.renderLeases.values()) {
            targetFramesPerSecond = resolveSceneFramesPerSecond(
                targetFramesPerSecond,
                [lease.framesPerSecond ?? this.ambientFramesPerSecond],
            );
        }
        this.targetFramesPerSecond = targetFramesPerSecond;
    }

    private getRenderFramesPerSecond() {
        const targetFramesPerSecond = this.getTargetFramesPerSecond();
        return this.renderRequests.size > 0 ||
            (targetFramesPerSecond === 0 &&
                this.coalescedRenderRequests.size > 0)
            ? Math.max(targetFramesPerSecond, 60)
            : targetFramesPerSecond;
    }

    private getRenderLeaseSummaries(): GameRuntimeRenderLeaseSummary[] {
        const summaries = new Map<string, GameRuntimeRenderLeaseSummary>();
        for (const lease of this.renderLeases.values()) {
            const framesPerSecond =
                lease.framesPerSecond ?? this.ambientFramesPerSecond;
            const summary = summaries.get(lease.owner);
            if (summary) {
                summary.leaseCount += 1;
                summary.framesPerSecond = Math.max(
                    summary.framesPerSecond,
                    framesPerSecond,
                );
            } else {
                summaries.set(lease.owner, {
                    framesPerSecond,
                    leaseCount: 1,
                    owner: lease.owner,
                });
            }
        }
        return [...summaries.values()].sort((left, right) =>
            left.owner.localeCompare(right.owner),
        );
    }

    private isEffectivelyVisible() {
        return (
            this.visibility.contextAvailable &&
            this.visibility.documentVisible &&
            (!this.visibility.requireCanvasVisible ||
                this.visibility.canvasVisible)
        );
    }

    private hasOrdinaryActiveWork() {
        return (
            this.getTargetFramesPerSecond() > 0 ||
            this.renderRequests.size > 0 ||
            this.fixedStepLeases.size > 0 ||
            this.deadlines.size > 0
        );
    }

    private hasRenderWork() {
        return this.getRenderFramesPerSecond() > 0;
    }

    private recordNonessentialHiddenWork() {
        this.counters.deferredWorkCount += 1;
        this.counters.nonessentialHiddenWorkCount += 1;
    }

    private observeDisplayFrameInterval(now: number) {
        if (this.frameIntervalCalibrated) {
            return;
        }
        if (this.frameIntervalCalibrationStartedAt === null) {
            this.displayFrameCalibrationBeganAt = now;
            this.frameIntervalCalibrationStartedAt = now;
            return;
        }

        const observedIntervalMs = now - this.frameIntervalCalibrationStartedAt;
        this.frameIntervalCalibrationStartedAt = now;
        this.displayFrameCalibrationAttemptCount += 1;
        if (
            Number.isFinite(observedIntervalMs) &&
            observedIntervalMs >= 1000 / 360 &&
            observedIntervalMs <= 1000 / 20
        ) {
            this.displayFrameCalibrationSamplesMs.push(observedIntervalMs);
        }
        const calibrationDurationMs =
            now - (this.displayFrameCalibrationBeganAt ?? now);
        const calibrationExhausted =
            this.displayFrameCalibrationAttemptCount >=
                maximumDisplayFrameCalibrationAttempts ||
            calibrationDurationMs >= maximumDisplayFrameCalibrationDurationMs;
        if (
            this.displayFrameCalibrationSamplesMs.length <
                displayFrameCalibrationSampleCount &&
            !calibrationExhausted
        ) {
            return;
        }

        const calibratedIntervalMs = median(
            this.displayFrameCalibrationSamplesMs,
        );
        this.displayFrameIntervalMs =
            calibratedIntervalMs > 0
                ? calibratedIntervalMs
                : defaultDisplayFrameIntervalMs;
        this.displayFrameCalibrationAttemptCount = 0;
        this.displayFrameCalibrationBeganAt = null;
        this.displayFrameCalibrationSamplesMs.length = 0;
        this.frameIntervalCalibrationStartedAt = null;
        this.frameIntervalCalibrated = true;
        this.counters.displayFrameCalibrationCount += 1;
    }

    private resetRenderFrameTarget(previousFramesPerSecond?: number) {
        const nextFramesPerSecond = this.getRenderFramesPerSecond();
        if (
            this.awaitingFrameReceipt &&
            this.lastInvalidatedAt !== null &&
            previousFramesPerSecond !== undefined &&
            nextFramesPerSecond > 0 &&
            nextFramesPerSecond < previousFramesPerSecond
        ) {
            this.nextRenderFrameTargetAt =
                this.lastInvalidatedAt + 1000 / nextFramesPerSecond;
            return;
        }
        this.nextRenderFrameTargetAt = null;
    }

    private isAwaitingFrame() {
        return this.awaitingFrameReceipt;
    }

    private consumeRenderFrameTarget(now: number) {
        const framesPerSecond = this.getRenderFramesPerSecond();
        if (framesPerSecond === 0) {
            this.resetRenderFrameTarget();
            return;
        }
        const intervalMs = 1000 / framesPerSecond;
        if (this.nextRenderFrameTargetAt === null) {
            this.nextRenderFrameTargetAt = now + intervalMs;
            return;
        }
        const elapsedIntervals = Math.max(
            0,
            Math.floor(
                (now + schedulerToleranceMs - this.nextRenderFrameTargetAt) /
                    intervalMs,
            ),
        );
        this.nextRenderFrameTargetAt += (elapsedIntervals + 1) * intervalMs;
    }

    private consumeRenderFrameTargetAfterExternalReceipt(now: number) {
        const framesPerSecond = this.getRenderFramesPerSecond();
        if (framesPerSecond === 0) {
            this.resetRenderFrameTarget();
            return;
        }

        const intervalMs = 1000 / framesPerSecond;
        const nextTargetAt = this.nextRenderFrameTargetAt;
        if (nextTargetAt === null) {
            this.nextRenderFrameTargetAt = now + intervalMs;
            return;
        }

        const elapsedIntervals = Math.max(
            0,
            Math.floor(
                (now + schedulerToleranceMs - nextTargetAt) / intervalMs,
            ),
        );
        this.nextRenderFrameTargetAt = Math.max(
            nextTargetAt + (elapsedIntervals + 1) * intervalMs,
            now + intervalMs,
        );
    }

    private deferRenderFrameTargetAfterExternalReceipt(now: number) {
        const framesPerSecond = this.getRenderFramesPerSecond();
        if (framesPerSecond === 0) {
            this.resetRenderFrameTarget();
            return;
        }

        const nextTargetAt = now + 1000 / framesPerSecond;
        this.nextRenderFrameTargetAt = Math.max(
            this.nextRenderFrameTargetAt ?? nextTargetAt,
            nextTargetAt,
        );
    }

    private isImmediateFollowUpToOwnedFrame(receiptAt: number) {
        if (
            !this.previousFrameReceiptWasOwned ||
            this.lastFrameReceiptAt === null
        ) {
            return false;
        }

        const framesPerSecond = this.getRenderFramesPerSecond();
        if (framesPerSecond === 0) {
            return false;
        }

        const elapsedMs = receiptAt - this.lastFrameReceiptAt;
        return (
            elapsedMs >= 0 &&
            elapsedMs <= 1000 / framesPerSecond + schedulerToleranceMs
        );
    }

    private getNextRenderDueAt(now: number) {
        const framesPerSecond = this.getRenderFramesPerSecond();
        if (framesPerSecond === 0) {
            return null;
        }

        const intervalMs = 1000 / framesPerSecond;
        if (this.invalidationRetryNotBeforeAt !== null) {
            return this.invalidationRetryNotBeforeAt;
        }
        const lastInvalidatedAt = this.lastInvalidatedAt;
        if (this.isAwaitingFrame()) {
            const retryAt =
                (lastInvalidatedAt ?? now) + Math.max(intervalMs * 2, 100);
            if (
                this.nextRenderFrameTargetAt !== null &&
                this.nextRenderFrameTargetAt > now + schedulerToleranceMs
            ) {
                return Math.min(this.nextRenderFrameTargetAt, retryAt);
            }
            return retryAt;
        }
        if (this.nextRenderFrameTargetAt === null) {
            return now;
        }

        return Math.max(now, this.nextRenderFrameTargetAt);
    }

    private getNextFixedStepDueAt() {
        let dueAt: number | null = null;
        for (const lease of this.fixedStepLeases.values()) {
            dueAt =
                dueAt === null
                    ? lease.nextDueAt
                    : Math.min(dueAt, lease.nextDueAt);
        }
        return dueAt;
    }

    private getNextDeadlineDueAt() {
        let dueAt: number | null = null;
        for (const deadline of this.deadlines.values()) {
            dueAt =
                dueAt === null
                    ? deadline.dueAt
                    : Math.min(dueAt, deadline.dueAt);
        }
        return dueAt;
    }

    private resolveNextWakeup(now: number): NextWakeup | null {
        if (this.disposed || !this.isEffectivelyVisible()) {
            return null;
        }
        const renderDueAt = this.getNextRenderDueAt(now);
        const fixedStepDueAt = this.getNextFixedStepDueAt();
        const deadlineDueAt = this.getNextDeadlineDueAt();
        const nonRenderDueAt =
            fixedStepDueAt === null
                ? deadlineDueAt
                : deadlineDueAt === null
                  ? fixedStepDueAt
                  : Math.min(fixedStepDueAt, deadlineDueAt);

        if (
            nonRenderDueAt !== null &&
            (renderDueAt === null ||
                nonRenderDueAt <= renderDueAt + schedulerToleranceMs)
        ) {
            return {
                dueAt: Math.max(now, nonRenderDueAt),
                kind: 'timeout',
            };
        }
        if (renderDueAt !== null && !this.frameIntervalCalibrated) {
            return { dueAt: null, kind: 'frame' };
        }

        const dueAt =
            renderDueAt === null
                ? nonRenderDueAt
                : nonRenderDueAt === null
                  ? renderDueAt
                  : Math.min(renderDueAt, nonRenderDueAt);
        return dueAt === null
            ? null
            : {
                  dueAt: Math.max(now, dueAt),
                  kind: 'timeout',
              };
    }

    private reconcileSchedule() {
        if (this.disposed || !this.isEffectivelyVisible()) {
            this.cancelPendingCallback();
            this.emitSnapshot();
            return;
        }

        const now = this.readNow();
        const nextWakeup = this.resolveNextWakeup(now);
        if (nextWakeup === null) {
            this.cancelPendingCallback();
            this.emitSnapshot();
            return;
        }

        if (
            this.pendingCallback?.kind === 'frame' &&
            nextWakeup.kind === 'frame'
        ) {
            this.emitSnapshot();
            return;
        }
        if (
            this.pendingCallback?.kind === 'timeout' &&
            nextWakeup.kind === 'timeout' &&
            this.pendingCallback.dueAt !== null &&
            nextWakeup.dueAt !== null &&
            this.pendingCallback.dueAt <=
                nextWakeup.dueAt + schedulerToleranceMs
        ) {
            // An earlier timer can safely reconcile a semantic render target,
            // deadline, or fixed-step target that moved later without a
            // cancellation/rearm pair.
            this.emitSnapshot();
            return;
        }

        this.cancelPendingCallback();
        this.scheduleCallback(nextWakeup, now);
        this.emitSnapshot();
    }

    private scheduleCallback(nextWakeup: NextWakeup, now: number) {
        const id = ++this.callbackSequence;
        if (nextWakeup.kind === 'frame') {
            const handle = this.requestFrameEffect((displayTimestampMs) => {
                this.handleScheduledCallback(id, displayTimestampMs);
            });
            this.pendingCallback = {
                dueAt: null,
                handle,
                id,
                kind: 'frame',
            };
            this.counters.scheduledCallbackCount += 1;
            return;
        }

        const dueAt = nextWakeup.dueAt ?? now;
        const delayMs = Math.min(maximumTimeoutMs, Math.max(0, dueAt - now));
        const handle = this.setTimeoutEffect(() => {
            this.handleScheduledCallback(id);
        }, delayMs);
        this.pendingCallback = {
            dueAt: now + delayMs,
            handle,
            id,
            kind: 'timeout',
        };
        this.counters.scheduledCallbackCount += 1;
    }

    private cancelPendingCallback() {
        const pendingCallback = this.pendingCallback;
        if (pendingCallback === null) {
            return;
        }
        this.pendingCallback = null;
        if (pendingCallback.kind === 'frame') {
            this.cancelFrameEffect(pendingCallback.handle);
        } else {
            this.clearTimeoutEffect(pendingCallback.handle);
        }
        this.counters.cancelledCallbackCount += 1;
    }

    private handleScheduledCallback(id: number, displayTimestampMs?: number) {
        if (this.disposed || this.pendingCallback?.id !== id) {
            return;
        }

        const callbackKind = this.pendingCallback.kind;
        this.pendingCallback = null;
        this.counters.wakeupCount += 1;
        if (!this.isEffectivelyVisible()) {
            this.recordNonessentialHiddenWork();
            this.emitSnapshot();
            return;
        }

        const now = this.readNow();
        const displayNow =
            callbackKind === 'frame' && Number.isFinite(displayTimestampMs)
                ? Math.max(0, displayTimestampMs ?? now)
                : now;
        try {
            if (callbackKind === 'frame' && this.hasRenderWork()) {
                this.observeDisplayFrameInterval(displayNow);
            }
            this.deliverDeadlines(now);
            if (!this.disposed) {
                this.deliverFixedSteps(now);
            }
            if (!this.disposed) {
                this.requestInvalidationIfDue(displayNow);
            }
        } finally {
            this.reconcileSchedule();
        }
    }

    private deliverDeadlines(now: number) {
        if (this.deadlines.size === 0) {
            return;
        }
        const dueDeadlines = [...this.deadlines.values()]
            .filter((deadline) => deadline.dueAt <= now + schedulerToleranceMs)
            .sort(
                (left, right) =>
                    left.dueAt - right.dueAt || left.sequence - right.sequence,
            );

        for (const deadline of dueDeadlines) {
            if (this.disposed) {
                return;
            }
            if (this.deadlines.get(deadline.owner)?.id !== deadline.id) {
                continue;
            }
            this.deadlines.delete(deadline.owner);
            this.counters.deadlineCount += 1;
            deadline.callback({
                latenessMs: Math.max(0, now - deadline.dueAt),
                nowMs: now,
                owner: deadline.owner,
                scheduledForMs: deadline.dueAt,
            });
        }
    }

    private deliverFixedSteps(now: number) {
        if (this.fixedStepLeases.size === 0) {
            return;
        }
        for (const [token, lease] of [...this.fixedStepLeases]) {
            if (this.disposed) {
                return;
            }
            if (
                this.fixedStepLeases.get(token) !== lease ||
                lease.nextDueAt > now + schedulerToleranceMs
            ) {
                continue;
            }

            const lateIntervals = Math.max(
                0,
                Math.floor((now - lease.nextDueAt) / lease.intervalMs),
            );
            this.counters.deferredWorkCount += lateIntervals;
            const deltaMs = Math.min(
                Math.max(0, now - lease.lastDeliveredAt),
                lease.maxDeltaMs,
            );
            lease.lastDeliveredAt = now;
            lease.nextDueAt = now + lease.intervalMs;
            this.counters.fixedStepCount += 1;
            this.counters.maxDeliveredDeltaMs = Math.max(
                this.counters.maxDeliveredDeltaMs,
                deltaMs,
            );
            try {
                lease.callback({ deltaMs, nowMs: now, owner: lease.owner });
            } catch (error) {
                if (this.fixedStepLeases.get(token) === lease) {
                    this.fixedStepLeases.delete(token);
                    this.counters.leaseReleasedCount += 1;
                }
                this.counters.fixedStepFailureCount += 1;
                throw error;
            }
        }
    }

    private requestInvalidationIfDue(now: number) {
        const renderDueAt = this.getNextRenderDueAt(now);
        if (renderDueAt === null || renderDueAt > now + schedulerToleranceMs) {
            return;
        }

        if (this.isAwaitingFrame()) {
            this.counters.missedFrameReceiptCount += 1;
        }
        this.consumeRenderFrameTarget(now);
        this.requestInvalidation(now);
    }

    private requestInvalidation(now: number) {
        // A failed effect did not submit a frame, but it still receives a
        // bounded retry delay so reconciliation cannot spin at display rate.
        try {
            this.invalidateEffect();
        } catch (error) {
            const framesPerSecond = this.getRenderFramesPerSecond();
            const intervalMs =
                framesPerSecond > 0
                    ? 1000 / framesPerSecond
                    : defaultDisplayFrameIntervalMs;
            this.awaitingFrameReceipt = false;
            this.invalidationRetryNotBeforeAt =
                now + Math.max(intervalMs * 2, 100);
            this.counters.invalidationFailureCount += 1;
            throw error;
        }
        this.awaitingFrameReceipt = true;
        this.invalidationRetryNotBeforeAt = null;
        this.lastInvalidatedAt = now;
        this.counters.invalidationCount += 1;
    }

    private emitSnapshot() {
        if (this.onSnapshotEffect) {
            this.onSnapshotEffect(this.getSnapshot());
        }
    }
}

export function createGameRuntimeScheduler(
    options: GameRuntimeSchedulerOptions,
) {
    return new GameRuntimeScheduler(options);
}
