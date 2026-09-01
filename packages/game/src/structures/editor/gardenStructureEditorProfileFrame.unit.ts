import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleGardenStructureEditorProfileFrame } from './gardenStructureEditorProfileFrame';

test('does not schedule an editor profile frame when telemetry is disabled', () => {
    let clockReadCount = 0;
    let scheduledCount = 0;
    const scheduled = scheduleGardenStructureEditorProfileFrame({
        enabled: false,
        now: () => {
            clockReadCount += 1;
            return 200;
        },
        onDuration: () => undefined,
        requestFrame: () => {
            scheduledCount += 1;
            return scheduledCount;
        },
        startedAt: 100,
    });

    assert.equal(scheduled, false);
    assert.equal(clockReadCount, 0);
    assert.equal(scheduledCount, 0);
});

test('measures from the carried action boundary on the next frame', () => {
    let callback: FrameRequestCallback | undefined;
    const durations: number[] = [];
    const scheduled = scheduleGardenStructureEditorProfileFrame({
        enabled: true,
        now: () => 550,
        onDuration: (durationMs) => durations.push(durationMs),
        requestFrame: (nextCallback) => {
            callback = nextCallback;
            return 1;
        },
        startedAt: 100,
    });

    assert.equal(scheduled, true);
    assert.equal(typeof callback, 'function');
    assert.deepEqual(durations, []);
    callback?.(500);
    assert.deepEqual(durations, [450]);
});
