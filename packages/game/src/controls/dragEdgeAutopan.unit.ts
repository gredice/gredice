import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getDragEdgeAutopanDelta,
    hasDragEdgeAutopanDelta,
} from './dragEdgeAutopan';

const viewport = {
    height: 300,
    left: 10,
    top: 20,
    width: 400,
};

function getDelta(pointer: { clientX: number; clientY: number }) {
    return getDragEdgeAutopanDelta({
        edgeInsetPx: 100,
        frameDeltaSeconds: 0.1,
        maxFrameDeltaSeconds: 1,
        maxSpeedPxPerSecond: 600,
        pointer,
        viewport,
    });
}

describe('getDragEdgeAutopanDelta', () => {
    it('stays idle when the pointer is away from the viewport edge', () => {
        const delta = getDelta({ clientX: 210, clientY: 170 });

        assert.deepEqual(delta, { x: 0, y: 0 });
        assert.equal(hasDragEdgeAutopanDelta(delta), false);
    });

    it('returns screen deltas that pan toward the right and bottom edges', () => {
        const delta = getDelta({ clientX: 360, clientY: 270 });

        assert.deepEqual(delta, { x: -30, y: -30 });
        assert.equal(hasDragEdgeAutopanDelta(delta), true);
    });

    it('returns screen deltas that pan toward the left and top edges', () => {
        const delta = getDelta({ clientX: 60, clientY: 70 });

        assert.deepEqual(delta, { x: 30, y: 30 });
    });

    it('continues at full speed when the pointer is outside the viewport', () => {
        const delta = getDelta({ clientX: 430, clientY: 340 });

        assert.deepEqual(delta, { x: -60, y: -60 });
    });

    it('caps large frame deltas to avoid jumps after a paused frame', () => {
        const delta = getDragEdgeAutopanDelta({
            edgeInsetPx: 100,
            frameDeltaSeconds: 1,
            maxFrameDeltaSeconds: 0.05,
            maxSpeedPxPerSecond: 600,
            pointer: { clientX: 430, clientY: 340 },
            viewport,
        });

        assert.deepEqual(delta, { x: -30, y: -30 });
    });
});
