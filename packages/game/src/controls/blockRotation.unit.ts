import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    canRotatePlacedBlock,
    didPointerLeaveRotationTarget,
    isRotationTapDrag,
} from './blockRotation';

test('keeps multi-cell entity footprints locked after placement', () => {
    assert.equal(canRotatePlacedBlock('Cow'), false);
    assert.equal(canRotatePlacedBlock('FishingBoat'), false);
    assert.equal(canRotatePlacedBlock('Horse'), false);
    assert.equal(canRotatePlacedBlock('Raised_Bed'), false);
    assert.equal(canRotatePlacedBlock('WoodenBench'), true);
});

test('a still pointer is a tap even when the block moves under it', () => {
    const down = { clientX: 400, clientY: 300, pointerType: 'mouse' };
    // The tap hop lifts the block between the two clicks of a double click,
    // so the world point under the pointer moves while the pointer does not.
    assert.equal(isRotationTapDrag(down, { ...down }), false);
    assert.equal(
        isRotationTapDrag(down, { ...down, clientX: 405, clientY: 302 }),
        false,
    );
    assert.equal(isRotationTapDrag(down, { ...down, clientX: 407 }), true);
});

test('touch taps tolerate more finger travel than mouse clicks', () => {
    const down = { clientX: 120, clientY: 80, pointerType: 'touch' };
    assert.equal(isRotationTapDrag(down, { ...down, clientY: 90 }), false);
    assert.equal(isRotationTapDrag(down, { ...down, clientY: 93 }), true);
});

test('a leave from one part of a block while another part is still hit keeps the press', () => {
    const rotatable = {};
    const pickable = {};
    const layer = {};
    // Pressing a hopping block hits its trim instead of the roof it was hovered
    // on; r3f then reports leaving the roof although the pointer is on the block.
    assert.equal(
        didPointerLeaveRotationTarget({
            eventObject: rotatable,
            intersections: [
                { eventObject: layer },
                { eventObject: rotatable },
                { eventObject: pickable },
            ],
        }),
        false,
    );
    assert.equal(
        didPointerLeaveRotationTarget({
            eventObject: rotatable,
            intersections: [{ eventObject: layer }],
        }),
        true,
    );
    assert.equal(
        didPointerLeaveRotationTarget({
            eventObject: rotatable,
            intersections: [],
        }),
        true,
    );
});
