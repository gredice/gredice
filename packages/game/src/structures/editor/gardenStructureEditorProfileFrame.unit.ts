import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleGardenStructureEditorProfileFrame } from './gardenStructureEditorProfileFrame';

test('does not schedule an editor profile frame when telemetry is disabled', () => {
    let scheduledCount = 0;
    const scheduled = scheduleGardenStructureEditorProfileFrame({
        enabled: false,
        onFrame: () => undefined,
        requestFrame: () => {
            scheduledCount += 1;
            return scheduledCount;
        },
    });

    assert.equal(scheduled, false);
    assert.equal(scheduledCount, 0);
});

test('schedules exactly one editor profile frame when telemetry is enabled', () => {
    let callback: FrameRequestCallback | undefined;
    const scheduled = scheduleGardenStructureEditorProfileFrame({
        enabled: true,
        onFrame: () => undefined,
        requestFrame: (nextCallback) => {
            callback = nextCallback;
            return 1;
        },
    });

    assert.equal(scheduled, true);
    assert.equal(typeof callback, 'function');
});
