import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    dragEdgeAutopanPushPx,
    getDragEdgeAutopanDelta,
    hasDragEdgeAutopanDelta,
    isDragEdgeAutopanArmed,
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

describe('isDragEdgeAutopanArmed', () => {
    // A 360 px phone canvas: the 96 px edge bands cover over half its width.
    const phone = { left: 0, top: 0, width: 360, height: 740 };
    const at = (clientX: number, clientY: number) => ({ clientX, clientY });

    it('stays off while a press that started in a band holds still or moves along it', () => {
        // Pomakni at x 313 in the right band, dragged straight down 90 px.
        for (const pointer of [at(313, 400), at(313, 450), at(310, 490)]) {
            assert.equal(
                isDragEdgeAutopanArmed({
                    start: at(313, 400),
                    pointer,
                    viewport: phone,
                }),
                false,
                `${pointer.clientX},${pointer.clientY}`,
            );
        }
    });

    it('arms when the pointer pushes further toward the start edge', () => {
        assert.equal(
            isDragEdgeAutopanArmed({
                start: at(313, 400),
                pointer: at(313 + dragEdgeAutopanPushPx, 410),
                viewport: phone,
            }),
            true,
        );
    });

    it('arms once the pointer leaves the band it started in', () => {
        assert.equal(
            isDragEdgeAutopanArmed({
                start: at(313, 400),
                pointer: at(200, 400),
                viewport: phone,
            }),
            true,
        );
    });

    it('arms at once outside every band', () => {
        assert.equal(
            isDragEdgeAutopanArmed({
                start: at(180, 370),
                pointer: at(180, 370),
                viewport: phone,
            }),
            true,
        );
    });

    it('takes a custom push distance', () => {
        assert.equal(
            isDragEdgeAutopanArmed({
                start: at(313, 400),
                pointer: at(318, 400),
                pushPx: 4,
                viewport: phone,
            }),
            true,
        );
    });
});
