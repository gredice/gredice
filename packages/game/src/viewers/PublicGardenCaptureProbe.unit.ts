import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createCaptureStabilityState,
    getNextCaptureStabilityFrameDelay,
    observeCaptureStability,
    resetCaptureStabilityState,
    resolveCaptureCameraZoom,
} from './PublicGardenCaptureProbe';

describe('capture stability', () => {
    it('counts the first signature as frame one and captures on the second stable frame', () => {
        const state = createCaptureStabilityState();

        assert.equal(
            observeCaptureStability(state, { now: 0, signature: 'ready' }),
            false,
        );
        assert.equal(state.stableFrames, 1);
        assert.equal(getNextCaptureStabilityFrameDelay(state, 0), 1500);
        assert.equal(
            observeCaptureStability(state, {
                now: 1500,
                signature: 'ready',
            }),
            true,
        );
        assert.equal(state.stableFrames, 2);
    });

    it('honors warmup after frame and duration stability are satisfied', () => {
        const state = createCaptureStabilityState();

        assert.equal(
            observeCaptureStability(state, { now: 0, signature: 'ready' }),
            false,
        );
        assert.equal(
            observeCaptureStability(state, { now: 500, signature: 'ready' }),
            false,
        );
        assert.equal(getNextCaptureStabilityFrameDelay(state, 500), 1000);
    });

    it('falls back after two nonblank frames without requiring a stable signature', () => {
        const state = createCaptureStabilityState();

        assert.equal(
            observeCaptureStability(state, { now: 0, signature: 'first' }),
            false,
        );
        assert.equal(
            observeCaptureStability(state, {
                now: 5000,
                signature: 'second',
            }),
            true,
        );
        assert.equal(state.stableFrames, 1);
        assert.equal(state.validFrames, 2);
    });

    it('keeps the fallback clock through churn but clears every counter on reset', () => {
        const state = createCaptureStabilityState();

        assert.equal(
            observeCaptureStability(state, { now: 0, signature: 'first' }),
            false,
        );
        assert.equal(
            observeCaptureStability(state, {
                now: 4999,
                signature: 'second',
            }),
            false,
        );
        assert.equal(getNextCaptureStabilityFrameDelay(state, 4999), 1);
        resetCaptureStabilityState(state);
        assert.deepEqual(state, createCaptureStabilityState());
        assert.equal(
            observeCaptureStability(state, {
                now: 5000,
                signature: 'third',
            }),
            false,
        );
        assert.equal(
            observeCaptureStability(state, {
                now: 9999,
                signature: 'fourth',
            }),
            false,
        );
        assert.equal(
            observeCaptureStability(state, {
                now: 10_000,
                signature: 'fifth',
            }),
            true,
        );
    });
});

describe('resolveCaptureCameraZoom', () => {
    it('fits the widest projected axis inside the requested safe area', () => {
        const zoom = resolveCaptureCameraZoom({
            bounds: { bottom: -1, left: -2, right: 2, top: 1 },
            cameraHeight: 500,
            cameraWidth: 1200,
            padding: 0.5,
        });

        assert.equal(zoom, 125);
    });

    it('accounts for an off-center projected garden without panning the sky', () => {
        const centered = resolveCaptureCameraZoom({
            bounds: { bottom: -1, left: -2, right: 2, top: 1 },
            cameraHeight: 500,
            cameraWidth: 1200,
            padding: 0.5,
        });
        const offCenter = resolveCaptureCameraZoom({
            bounds: { bottom: -1, left: -1, right: 3, top: 1 },
            cameraHeight: 500,
            cameraWidth: 1200,
            padding: 0.5,
        });

        assert.ok(offCenter !== null && centered !== null);
        assert.ok(offCenter < centered);
    });
});
