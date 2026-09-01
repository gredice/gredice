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
const maximumRenderInvalidationPhaseMarginMs = 2;
const schedulerToleranceMs = 0.5;
const maximumTimeoutMs = 2_147_483_647;
const maximumRequestedFrames = 60;

type SchedulerHandle = unknown;

export type GameRuntimeSchedulerPendingCallback = 'none' | 'timeout';

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
    deadlineCount: number;
    deadlineOwners: readonly string[];
    deferredWorkCount: number;
    displayFrameCalibrationCount: number;
    /** Last interval established by bounded calibration, not a live monitor probe. */
    displayFrameIntervalMs: number | null;
    disposed: boolean;
    effectiveVisible: boolean;
    fixedStepCount: number;
    fixedStepFailureCount: number;
    fixedStepOwners: readonly string[];
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
    clearTimeout: (handle: SchedulerHandle) => void;
    initialVisibility?: Partial<GameRuntimeSchedulerVisibility>;
    invalidate: () => void;
    maxDeliveredDeltaMs?: number;
    now: () => number;
    onSnapshot?: (snapshot: GameRuntimeSchedulerSnapshot) => void;
    setTimeout: (callback: () => void, delayMs: number) => SchedulerHandle;
};

export type GameRuntimeRenderLeaseSummary = {
    framesPerSecond: number;
    leaseCount: number;
    owner: string;
};

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
    dueAt: number;
    handle: SchedulerHandle;
    id: number;
    kind: 'timeout';
};

type NextWakeup = {
    dueAt: number;
    kind: 'timeout';
};

type MutableSchedulerCounters = {
    cancelledCallbackCount: number;
    deadlineCount: number;
    deferredWorkCount: number;
    displayFrameCalibrationCount: number;
    fixedStepCount: number;
    fixedStepFailureCount: number;
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
    private readonly clearTimeoutEffect: (handle: SchedulerHandle) => void;
    private readonly counters: MutableSchedulerCounters = {
        cancelledCallbackCount: 0,
        deadlineCount: 0,
        deferredWorkCount: 0,
        displayFrameCalibrationCount: 0,
        fixedStepCount: 0,
        fixedStepFailureCount: 0,
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
    private lastFrameCallbackAt: number | null = null;
    private lastInvalidatedAt: number | null = null;
    private nextRenderFrameTargetAt: number | null = null;
    private readonly maxDeliveredDeltaMs: number;
    private readonly nowEffect: () => number;
    private onSnapshotEffect:
        | ((snapshot: GameRuntimeSchedulerSnapshot) => void)
        | undefined;
    private pendingCallback: PendingCallback | null = null;
    private readonly renderLeases = new Map<symbol, RenderLease>();
    private readonly renderRequests = new Map<string, number>();
    private readonly resumeListeners = new Set<() => void>();
    private readonly setTimeoutEffect: (
        callback: () => void,
        delayMs: number,
    ) => SchedulerHandle;
    private visibility: GameRuntimeSchedulerVisibility;

    constructor(options: GameRuntimeSchedulerOptions) {
        this.ambientFramesPerSecond = normalizeSceneFramesPerSecond(
            options.ambientFramesPerSecond ?? defaultAmbientFramesPerSecond,
        );
        this.baseFramesPerSecond = normalizeSceneFramesPerSecond(
            options.baseFramesPerSecond ?? 0,
        );
        this.clearTimeoutEffect = options.clearTimeout;
        this.invalidateEffect = options.invalidate;
        this.maxDeliveredDeltaMs = normalizePositiveMilliseconds(
            options.maxDeliveredDeltaMs ?? defaultMaximumDeliveredDeltaMs,
            defaultMaximumDeliveredDeltaMs,
        );
        this.nowEffect = options.now;
        this.onSnapshotEffect = options.onSnapshot;
        this.setTimeoutEffect = options.setTimeout;
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
        this.counters.leaseAcquiredCount += 1;
        const nextTarget = this.getRenderFramesPerSecond();
        if (nextTarget !== previousTarget) {
            this.resetRenderFrameTarget();
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
            this.counters.leaseReleasedCount += 1;
            if (this.getRenderFramesPerSecond() !== previousReleaseTarget) {
                this.resetRenderFrameTarget();
            }
            this.reconcileSchedule();
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
            this.resetRenderFrameTarget();
        }
        this.reconcileSchedule();
        return true;
    }

    /** Records entry into the adapter's R3F useFrame callback. */
    recordFrameCallback(displayTimestampMs?: number) {
        if (this.disposed) {
            return;
        }
        const now = this.readNow();
        const displayNow = Number.isFinite(displayTimestampMs)
            ? Math.max(0, displayTimestampMs ?? now)
            : now;
        const wasAwaitingFrame = this.isAwaitingFrame();
        this.counters.r3fFrameCallbackCount += 1;
        if (!this.isEffectivelyVisible()) {
            this.counters.nonessentialHiddenWorkCount += 1;
            this.emitSnapshot();
            return;
        }

        const previousTarget = this.getRenderFramesPerSecond();
        for (const [reason, remainingFrames] of this.renderRequests) {
            if (remainingFrames <= 1) {
                this.renderRequests.delete(reason);
            } else {
                this.renderRequests.set(reason, remainingFrames - 1);
            }
        }
        if (this.getRenderFramesPerSecond() !== previousTarget) {
            this.resetRenderFrameTarget();
        }
        const hasRenderWork = this.hasRenderWork();
        if (hasRenderWork) {
            this.observeDisplayFrameInterval(displayNow);
        }
        this.lastFrameCallbackAt = now;
        if (!this.frameIntervalCalibrated && hasRenderWork) {
            this.requestInvalidation(now);
        }
        if (this.frameIntervalCalibrated) {
            this.advanceRenderFrameTarget(displayNow, wasAwaitingFrame);
        }
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
        if (this.getRenderFramesPerSecond() !== previousTarget) {
            this.resetRenderFrameTarget();
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
        if (this.getRenderFramesPerSecond() !== previousTarget) {
            this.resetRenderFrameTarget();
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

        const now = this.readNow();
        this.lastInvalidatedAt = null;
        this.lastFrameCallbackAt = null;
        this.resetRenderFrameTarget();
        this.displayFrameCalibrationAttemptCount = 0;
        this.displayFrameCalibrationBeganAt = null;
        this.displayFrameCalibrationSamplesMs.length = 0;
        this.frameIntervalCalibrationStartedAt = null;
        this.frameIntervalCalibrated = false;
        if (!isVisible) {
            this.counters.suspendCount += 1;
            if (this.hasActiveWork()) {
                this.counters.deferredWorkCount += 1;
            }
            for (const reason of this.renderRequests.keys()) {
                this.renderRequests.set(reason, 1);
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
            deadlineOwners: uniqueSortedOwners(this.deadlines.keys()),
            displayFrameIntervalMs: this.frameIntervalCalibrated
                ? this.displayFrameIntervalMs
                : null,
            disposed: this.disposed,
            effectiveVisible: this.isEffectivelyVisible(),
            fixedStepOwners: uniqueSortedOwners(
                [...this.fixedStepLeases.values()].map((lease) => lease.owner),
            ),
            loopActive: this.pendingCallback !== null,
            ownedInvalidationCount: this.counters.invalidationCount,
            pendingCallbackDueAt: this.pendingCallback?.dueAt ?? null,
            pendingCallbackKind,
            renderLeaseOwners: uniqueSortedOwners(
                [...this.renderLeases.values()].map((lease) => lease.owner),
            ),
            renderLeaseSummaries: this.getRenderLeaseSummaries(),
            renderRequestReasons: [...this.renderRequests.keys()].sort(
                (left, right) => left.localeCompare(right),
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
        this.renderLeases.clear();
        this.renderRequests.clear();
        this.activationListeners.clear();
        this.resumeListeners.clear();
        this.emitSnapshot();
    }

    private readNow() {
        const now = this.nowEffect();
        return Number.isFinite(now) ? Math.max(0, now) : 0;
    }

    private getTargetFramesPerSecond() {
        return resolveSceneFramesPerSecond(
            this.baseFramesPerSecond,
            [...this.renderLeases.values()].map(
                (lease) => lease.framesPerSecond ?? this.ambientFramesPerSecond,
            ),
        );
    }

    private getRenderFramesPerSecond() {
        const targetFramesPerSecond = this.getTargetFramesPerSecond();
        return this.renderRequests.size > 0
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

    private hasActiveWork() {
        return (
            this.hasRenderWork() ||
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

    private advanceRenderFrameTarget(now: number, wasAwaitingFrame: boolean) {
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
        if (this.nextRenderFrameTargetAt > now + schedulerToleranceMs) {
            // The adapter requested one display frame for this cadence target.
            // If that frame arrives early, consume exactly one target so a
            // variable-refresh display cannot cause a duplicate request. An
            // unrelated external frame must leave the future target intact.
            if (wasAwaitingFrame) {
                this.nextRenderFrameTargetAt += intervalMs;
            }
            return;
        }

        const elapsedIntervals = Math.floor(
            (now + schedulerToleranceMs - this.nextRenderFrameTargetAt) /
                intervalMs,
        );
        this.nextRenderFrameTargetAt += (elapsedIntervals + 1) * intervalMs;
    }

    private resetRenderFrameTarget() {
        this.nextRenderFrameTargetAt = null;
    }

    private isAwaitingFrame() {
        return (
            this.lastInvalidatedAt !== null &&
            (this.lastFrameCallbackAt === null ||
                this.lastFrameCallbackAt <= this.lastInvalidatedAt)
        );
    }

    private getNextRenderDueAt(now: number) {
        const framesPerSecond = this.getRenderFramesPerSecond();
        if (framesPerSecond === 0) {
            return null;
        }

        const intervalMs = 1000 / framesPerSecond;
        const lastInvalidatedAt = this.lastInvalidatedAt;
        if (this.isAwaitingFrame()) {
            return (lastInvalidatedAt ?? now) + Math.max(intervalMs * 2, 100);
        }
        if (
            !this.frameIntervalCalibrated &&
            this.frameIntervalCalibrationStartedAt !== null
        ) {
            return null;
        }
        if (
            !this.frameIntervalCalibrated ||
            this.nextRenderFrameTargetAt === null
        ) {
            return now;
        }

        const displayIntervalMs = this.displayFrameIntervalMs;
        const phaseMarginMs = Math.min(
            maximumRenderInvalidationPhaseMarginMs,
            displayIntervalMs / 4,
        );
        // Calibration supplies only a bounded request lead. Treating an old
        // interval as a display lattice after moving the canvas between
        // monitors can preserve the average while producing alternating short
        // and long frame gaps.
        const earliestCadenceInvalidationAt =
            this.nextRenderFrameTargetAt -
            Math.min(displayIntervalMs, defaultDisplayFrameIntervalMs) +
            phaseMarginMs;
        return Math.max(now, earliestCadenceInvalidationAt);
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
        const nonRenderDueAt = [fixedStepDueAt, deadlineDueAt].reduce<
            number | null
        >((earliest, dueAt) => {
            if (dueAt === null) {
                return earliest;
            }
            return earliest === null ? dueAt : Math.min(earliest, dueAt);
        }, null);

        const dueAt = [renderDueAt, nonRenderDueAt].reduce<number | null>(
            (earliest, candidate) => {
                if (candidate === null) {
                    return earliest;
                }
                return earliest === null
                    ? candidate
                    : Math.min(earliest, candidate);
            },
            null,
        );
        return dueAt === null
            ? null
            : { dueAt: Math.max(now, dueAt), kind: 'timeout' };
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
            this.pendingCallback?.kind === nextWakeup.kind &&
            Math.abs(this.pendingCallback.dueAt - nextWakeup.dueAt) <=
                schedulerToleranceMs
        ) {
            this.emitSnapshot();
            return;
        }

        this.cancelPendingCallback();
        this.scheduleCallback(nextWakeup, now);
        this.emitSnapshot();
    }

    private scheduleCallback(nextWakeup: NextWakeup, now: number) {
        const id = ++this.callbackSequence;
        const delayMs = Math.min(
            maximumTimeoutMs,
            Math.max(0, nextWakeup.dueAt - now),
        );
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
        this.clearTimeoutEffect(pendingCallback.handle);
        this.counters.cancelledCallbackCount += 1;
    }

    private handleScheduledCallback(id: number) {
        if (
            this.disposed ||
            this.pendingCallback?.id !== id ||
            this.pendingCallback.kind !== 'timeout'
        ) {
            return;
        }

        this.pendingCallback = null;
        this.counters.wakeupCount += 1;
        if (!this.isEffectivelyVisible()) {
            this.recordNonessentialHiddenWork();
            this.emitSnapshot();
            return;
        }

        const now = this.readNow();
        try {
            this.deliverDeadlines(now);
            if (!this.disposed) {
                this.deliverFixedSteps(now);
            }
            if (!this.disposed) {
                this.requestInvalidationIfDue(now);
            }
        } finally {
            this.reconcileSchedule();
        }
    }

    private deliverDeadlines(now: number) {
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
        this.requestInvalidation(now);
    }

    private requestInvalidation(now: number) {
        // Consume the attempt before invoking user code so a failure cannot
        // reconcile into an unbounded zero-delay retry loop.
        this.lastInvalidatedAt = now;

        try {
            this.invalidateEffect();
        } catch (error) {
            this.counters.invalidationFailureCount += 1;
            throw error;
        }
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
