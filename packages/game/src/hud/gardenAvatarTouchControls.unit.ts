import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowGardenAvatarTouchControls } from './gardenAvatarTouchControls';

test('shows avatar touch controls for a coarse touch-first device at any viewport width', () => {
    assert.equal(
        shouldShowGardenAvatarTouchControls({
            coarsePointer: true,
            hoverNone: true,
            maxTouchPoints: 5,
        }),
        true,
    );
});

test('shows avatar touch controls when a touch device cannot hover', () => {
    assert.equal(
        shouldShowGardenAvatarTouchControls({
            coarsePointer: false,
            hoverNone: true,
            maxTouchPoints: 1,
        }),
        true,
    );
});

test('keeps keyboard and mouse controls on non-touch and hover-capable devices', () => {
    assert.equal(
        shouldShowGardenAvatarTouchControls({
            coarsePointer: false,
            hoverNone: false,
            maxTouchPoints: 0,
        }),
        false,
    );
    assert.equal(
        shouldShowGardenAvatarTouchControls({
            coarsePointer: false,
            hoverNone: false,
            maxTouchPoints: 10,
        }),
        false,
    );
});
