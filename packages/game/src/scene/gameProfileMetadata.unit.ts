import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    beginGardenStructurePointerResolution,
    createRuntimeFrameLoopProfileTelemetry,
    getGardenStructureProfileP95,
    readGameProfileMetadata,
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
