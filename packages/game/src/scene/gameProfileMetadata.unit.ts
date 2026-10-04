import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    bindRuntimeFrameLoopProfileTelemetry,
    createRuntimeFrameLoopProfileTelemetry,
} from './gameProfileMetadata';

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
            awaitingFrameReceipt: false,
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
            pendingFrameReceiptReconciliationWakeupCount: 0,
            postCalibrationFrameWakeupCount: 0,
            productiveWakeupCount: 0,
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
            retainedTimeoutReconciliationWakeupCount: 0,
            unexpectedNoWorkWakeupCount: 0,
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
        let awaitingFrameReceipt = true;
        let ownedInvalidationCount = 7;
        let pendingFrameReceiptReconciliationWakeupCount = 2;
        let sceneTimeSeconds = 12;
        let snapshotReadCount = 0;
        const unbind = bindRuntimeFrameLoopProfileTelemetry(
            telemetry,
            () => {
                snapshotReadCount += 1;
                return {
                    ...createRuntimeFrameLoopProfileTelemetry(),
                    awaitingFrameReceipt,
                    ownedInvalidationCount,
                    pendingFrameReceiptReconciliationWakeupCount,
                    sceneTimeSeconds,
                };
            },
            (callback) => cacheResets.push(callback),
        );

        assert.equal(snapshotReadCount, 0);
        const first = structuredClone(telemetry);
        assert.equal(first.ownedInvalidationCount, 7);
        assert.equal(first.awaitingFrameReceipt, true);
        assert.equal(first.pendingFrameReceiptReconciliationWakeupCount, 2);
        assert.equal(first.sceneTimeSeconds, 12);
        assert.equal(snapshotReadCount, 1);
        awaitingFrameReceipt = false;
        ownedInvalidationCount = 9;
        pendingFrameReceiptReconciliationWakeupCount = 3;
        sceneTimeSeconds = 13;
        assert.equal(telemetry.awaitingFrameReceipt, true);
        assert.equal(telemetry.ownedInvalidationCount, 7);
        assert.equal(telemetry.pendingFrameReceiptReconciliationWakeupCount, 2);
        assert.equal(telemetry.sceneTimeSeconds, 12);
        assert.equal(snapshotReadCount, 1);

        cacheResets.shift()?.();
        const second = structuredClone(telemetry);
        assert.equal(second.awaitingFrameReceipt, false);
        assert.equal(second.ownedInvalidationCount, 9);
        assert.equal(second.pendingFrameReceiptReconciliationWakeupCount, 3);
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
