import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRuntimeFrameLoopProfileTelemetry } from './gameProfileMetadata';

describe('createRuntimeFrameLoopProfileTelemetry', () => {
    it('creates an independent zeroed profile-only scheduler snapshot', () => {
        const first = createRuntimeFrameLoopProfileTelemetry();
        const second = createRuntimeFrameLoopProfileTelemetry();

        assert.notEqual(first, second);
        assert.deepEqual(first, {
            activeLeaseCount: 0,
            cancelledCallbackCount: 0,
            canvasVisible: false,
            documentVisible: false,
            effectiveVisible: false,
            loopActive: false,
            ownedInvalidationCount: 0,
            resumeCount: 0,
            scheduledCallbackCount: 0,
            suspendCount: 0,
            targetFramesPerSecond: 0,
            wakeupCount: 0,
        });

        first.wakeupCount += 1;
        assert.equal(second.wakeupCount, 0);
    });
});
