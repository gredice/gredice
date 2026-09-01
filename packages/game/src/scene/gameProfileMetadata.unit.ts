import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRuntimeFrameLoopProfileTelemetry } from './gameProfileMetadata';

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
            first.renderRequestReasons,
            second.renderRequestReasons,
        );
        assert.deepEqual(second.renderLeaseOwners, []);
        assert.deepEqual(second.renderLeaseSummaries, []);
    });
});
