import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    beginGardenStructurePointerResolution,
    bindRuntimeFrameLoopProfileTelemetry,
    createRuntimeFrameLoopProfileTelemetry,
    getGardenStructureProfileP95,
    readGameProfileMetadata,
    recordGardenStructureAvatarCollisionStep,
    recordGardenStructureCompileDurations,
    recordGardenStructureEditorAction,
    recordGardenStructurePointerResolution,
    setGardenStructureProfileTelemetryEnabled,
} from './gameProfileMetadata';

describe('getGardenStructureProfileP95', () => {
    it('uses the nearest-rank ceil(n * 0.95) - 1 index', () => {
        assert.equal(getGardenStructureProfileP95([]), 0);
        assert.equal(getGardenStructureProfileP95([9]), 9);
        assert.equal(
            getGardenStructureProfileP95(
                Array.from({ length: 20 }, (_, index) => index + 1),
            ),
            19,
        );
        assert.equal(
            getGardenStructureProfileP95(
                Array.from({ length: 21 }, (_, index) => index + 1),
            ),
            20,
        );
    });
});

describe('garden structure editor-action profile', () => {
    it('retains the lifetime maximum after the bounded percentile window advances', () => {
        const previousWindow = Object.getOwnPropertyDescriptor(
            globalThis,
            'window',
        );
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {},
        });
        try {
            setGardenStructureProfileTelemetryEnabled(true);
            recordGardenStructureEditorAction('early-stall', 600);
            for (let sample = 0; sample < 64; sample += 1) {
                recordGardenStructureEditorAction('steady', 10);
            }

            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureEditorActionDurationMaxMs,
                600,
            );
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureEditorActionDurationP95Ms,
                10,
            );
            assert.equal(
                readGameProfileMetadata()?.gardenStructureEditorActionCount,
                64,
            );

            setGardenStructureProfileTelemetryEnabled(true);
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureEditorActionDurationMaxMs,
                0,
            );
            setGardenStructureProfileTelemetryEnabled(false);
        } finally {
            if (previousWindow) {
                Object.defineProperty(globalThis, 'window', previousWindow);
            } else {
                Reflect.deleteProperty(globalThis, 'window');
            }
        }
    });
});

describe('garden structure avatar collision-step profile', () => {
    it('keeps a bounded nearest-rank p95 and resets before a new session', () => {
        const previousWindow = Object.getOwnPropertyDescriptor(
            globalThis,
            'window',
        );
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {},
        });
        try {
            setGardenStructureProfileTelemetryEnabled(false);
            recordGardenStructureAvatarCollisionStep(5);
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureAvatarCollisionStepCount,
                0,
            );
            setGardenStructureProfileTelemetryEnabled(true);
            recordGardenStructureAvatarCollisionStep(Number.NaN);
            recordGardenStructureAvatarCollisionStep(-1);
            for (let sample = 1; sample <= 20; sample += 1) {
                recordGardenStructureAvatarCollisionStep(sample * 0.05);
            }

            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureAvatarCollisionStepCount,
                20,
            );
            assert.ok(
                Math.abs(
                    (readGameProfileMetadata()
                        ?.gardenStructureAvatarCollisionStepDurationP95Ms ??
                        0) - 0.95,
                ) < 0.000_001,
            );
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureAvatarCollisionStepDurationMaxMs,
                1,
            );

            setGardenStructureProfileTelemetryEnabled(true);
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureAvatarCollisionStepCount,
                0,
            );
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureAvatarCollisionStepDurationP95Ms,
                0,
            );
            for (let durationMs = 11; durationMs <= 30; durationMs += 1) {
                recordGardenStructureAvatarCollisionStep(durationMs);
            }
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureAvatarCollisionStepDurationP95Ms,
                30,
            );
            setGardenStructureProfileTelemetryEnabled(false);
        } finally {
            if (previousWindow) {
                Object.defineProperty(globalThis, 'window', previousWindow);
            } else {
                Reflect.deleteProperty(globalThis, 'window');
            }
        }
    });
});

describe('garden structure compile profile maxima', () => {
    it('retains miss and navigation maxima when later current samples are zero', () => {
        const previousWindow = Object.getOwnPropertyDescriptor(
            globalThis,
            'window',
        );
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {},
        });
        try {
            setGardenStructureProfileTelemetryEnabled(true);
            recordGardenStructureCompileDurations({
                cacheOutcome: 'miss',
                compileDurationMs: 120,
                lookupDurationMs: 120,
                navigationCompileDurationMs: 120,
            });
            recordGardenStructureCompileDurations({
                cacheOutcome: 'hit',
                compileDurationMs: 0,
                lookupDurationMs: 20,
                navigationCompileDurationMs: 0,
            });

            assert.equal(
                readGameProfileMetadata()?.gardenStructureCompileDurationMs,
                0,
            );
            assert.equal(
                readGameProfileMetadata()?.gardenStructureCompileDurationMaxMs,
                120,
            );
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureNavigationCompileDurationMs,
                0,
            );
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureNavigationCompileDurationMaxMs,
                120,
            );
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructurePlanCacheLookupDurationMs,
                20,
            );
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructurePlanCacheLookupDurationMaxMs,
                120,
            );
            setGardenStructureProfileTelemetryEnabled(false);
        } finally {
            if (previousWindow) {
                Object.defineProperty(globalThis, 'window', previousWindow);
            } else {
                Reflect.deleteProperty(globalThis, 'window');
            }
        }
    });
});

describe('garden structure pointer profile boundary', () => {
    it('records one duration only after a matching enabled start', () => {
        const previousWindow = Object.getOwnPropertyDescriptor(
            globalThis,
            'window',
        );
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {},
        });
        try {
            setGardenStructureProfileTelemetryEnabled(true);
            beginGardenStructurePointerResolution(10);
            recordGardenStructurePointerResolution(14.5);
            recordGardenStructurePointerResolution(20);

            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureEditorPointerResolutionCount,
                1,
            );
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureEditorPointerResolutionMaxMs,
                4.5,
            );
            assert.equal(
                readGameProfileMetadata()
                    ?.gardenStructureEditorPointerResolutionTotalMs,
                4.5,
            );
            setGardenStructureProfileTelemetryEnabled(false);
        } finally {
            if (previousWindow) {
                Object.defineProperty(globalThis, 'window', previousWindow);
            } else {
                Reflect.deleteProperty(globalThis, 'window');
            }
        }
    });
});

describe('createRuntimeFrameLoopProfileTelemetry', () => {
    it('creates an independent zeroed profile-only scheduler snapshot', () => {
        const first = createRuntimeFrameLoopProfileTelemetry();
        const second = createRuntimeFrameLoopProfileTelemetry();

        assert.notEqual(first, second);
        assert.deepEqual(first, {
            activeDeadlineCount: 0,
            activeFixedStepLeaseCount: 0,
            activeLeaseCount: 0,
            activeRenderLeaseCount: 0,
            callbackPending: false,
            cancelledCallbackCount: 0,
            canvasVisible: false,
            coalescedRenderRequestReasons: [],
            contextAvailable: false,
            deadlineCount: 0,
            deadlineOwners: [],
            deferredWorkCount: 0,
            displayFrameCalibrationCount: 0,
            displayFrameIntervalMs: null,
            disposed: false,
            documentVisible: false,
            effectiveVisible: false,
            fixedStepCount: 0,
            fixedStepFailureCount: 0,
            fixedStepOwners: [],
            hiddenCoalescedRenderRequestCount: 0,
            hiddenDeferredCoalescedRenderRequestCount: 0,
            hiddenDeferredRenderRequestCount: 0,
            invalidationCount: 0,
            invalidationFailureCount: 0,
            leaseAcquiredCount: 0,
            leaseReleasedCount: 0,
            loopActive: false,
            maxDeliveredDeltaMs: 0,
            missedFrameReceiptCount: 0,
            nonessentialHiddenWorkCount: 0,
            ownedInvalidationCount: 0,
            pendingCallbackDueAt: null,
            pendingCallbackKind: 'none',
            renderLeaseOwners: [],
            renderLeaseSummaries: [],
            renderRequestReasons: [],
            requireCanvasVisible: true,
            resumeCount: 0,
            r3fFrameCallbackCount: 0,
            sceneTimeSeconds: 0,
            scheduledCallbackCount: 0,
            suspendCount: 0,
            targetFramesPerSecond: 0,
            wakeupCount: 0,
        });

        first.wakeupCount += 1;
        assert.equal(second.wakeupCount, 0);
        assert.notEqual(first.deadlineOwners, second.deadlineOwners);
        assert.notEqual(first.fixedStepOwners, second.fixedStepOwners);
        assert.notEqual(first.renderLeaseOwners, second.renderLeaseOwners);
        assert.notEqual(
            first.renderLeaseSummaries,
            second.renderLeaseSummaries,
        );
        assert.notEqual(
            first.coalescedRenderRequestReasons,
            second.coalescedRenderRequestReasons,
        );
        assert.notEqual(
            first.renderRequestReasons,
            second.renderRequestReasons,
        );
        assert.deepEqual(second.renderLeaseOwners, []);
        assert.deepEqual(second.renderLeaseSummaries, []);
    });
});

describe('bindRuntimeFrameLoopProfileTelemetry', () => {
    it('pulls one exact snapshot per synchronous read burst and leaves a writable final value', () => {
        const telemetry = createRuntimeFrameLoopProfileTelemetry();
        const cacheResets: (() => void)[] = [];
        let ownedInvalidationCount = 7;
        let sceneTimeSeconds = 12;
        let snapshotReadCount = 0;
        const unbind = bindRuntimeFrameLoopProfileTelemetry(
            telemetry,
            () => {
                snapshotReadCount += 1;
                return {
                    ...createRuntimeFrameLoopProfileTelemetry(),
                    ownedInvalidationCount,
                    sceneTimeSeconds,
                };
            },
            (callback) => cacheResets.push(callback),
        );

        assert.equal(snapshotReadCount, 0);
        const first = structuredClone(telemetry);
        assert.equal(first.ownedInvalidationCount, 7);
        assert.equal(first.sceneTimeSeconds, 12);
        assert.equal(snapshotReadCount, 1);
        ownedInvalidationCount = 9;
        sceneTimeSeconds = 13;
        assert.equal(telemetry.ownedInvalidationCount, 7);
        assert.equal(telemetry.sceneTimeSeconds, 12);
        assert.equal(snapshotReadCount, 1);

        cacheResets.shift()?.();
        const second = structuredClone(telemetry);
        assert.equal(second.ownedInvalidationCount, 9);
        assert.equal(second.sceneTimeSeconds, 13);
        assert.equal(snapshotReadCount, 2);

        unbind();
        ownedInvalidationCount = 11;
        sceneTimeSeconds = 14;
        assert.equal(telemetry.ownedInvalidationCount, 9);
        assert.equal(telemetry.sceneTimeSeconds, 13);
        telemetry.ownedInvalidationCount = 10;
        assert.equal(telemetry.ownedInvalidationCount, 10);
    });

    it('samples hot RAF scalars without constructing a full scheduler snapshot', () => {
        const telemetry = createRuntimeFrameLoopProfileTelemetry();
        const cacheResets: (() => void)[] = [];
        let activeLeaseCount = 3;
        let fullSnapshotReadCount = 0;
        let frequentSnapshotReadCount = 0;
        const unbind = bindRuntimeFrameLoopProfileTelemetry(
            telemetry,
            () => {
                fullSnapshotReadCount += 1;
                return {
                    ...createRuntimeFrameLoopProfileTelemetry(),
                    activeLeaseCount,
                    activeRenderLeaseCount: activeLeaseCount,
                    targetFramesPerSecond: 30,
                };
            },
            (callback) => cacheResets.push(callback),
            () => {
                frequentSnapshotReadCount += 1;
                return {
                    activeLeaseCount,
                    activeRenderLeaseCount: activeLeaseCount,
                    targetFramesPerSecond: 30,
                };
            },
        );

        assert.equal(telemetry.activeLeaseCount, 3);
        assert.equal(telemetry.targetFramesPerSecond, 30);
        assert.equal(frequentSnapshotReadCount, 1);
        assert.equal(fullSnapshotReadCount, 0);

        activeLeaseCount = 4;
        assert.equal(telemetry.activeLeaseCount, 3);
        cacheResets.shift()?.();
        assert.equal(telemetry.activeLeaseCount, 4);
        assert.equal(frequentSnapshotReadCount, 2);
        assert.equal(fullSnapshotReadCount, 0);

        cacheResets.shift()?.();
        const full = structuredClone(telemetry);
        assert.equal(full.activeLeaseCount, 4);
        assert.equal(full.targetFramesPerSecond, 30);
        assert.equal(fullSnapshotReadCount, 1);
        assert.equal(frequentSnapshotReadCount, 2);

        unbind();
        assert.equal(fullSnapshotReadCount, 2);
    });
});
