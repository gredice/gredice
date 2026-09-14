import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createCaptureStabilityState,
    flipCapturePixelRows,
    getNextCaptureStabilityFrameDelay,
    observeCaptureStability,
    pollCaptureFence,
    resetCaptureStabilityState,
    resolveCaptureCameraZoom,
    resolveCaptureContextUnpremultiplyAlpha,
    resolveCaptureFencePollOutcome,
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

describe('capture pixel readback', () => {
    it('flips bottom-origin WebGL rows into top-origin image rows', () => {
        const bottomLeft = [1, 2, 3, 4];
        const bottomRight = [5, 6, 7, 8];
        const topLeft = [9, 10, 11, 12];
        const topRight = [13, 14, 15, 16];

        assert.deepEqual(
            [
                ...flipCapturePixelRows(
                    new Uint8Array([
                        ...bottomLeft,
                        ...bottomRight,
                        ...topLeft,
                        ...topRight,
                    ]),
                    2,
                    2,
                    false,
                ),
            ],
            [...topLeft, ...topRight, ...bottomLeft, ...bottomRight],
        );
    });

    it('rejects malformed readback dimensions before encoding', () => {
        assert.throws(
            () => flipCapturePixelRows(new Uint8Array(4), 2, 1, false),
            /invalid dimensions/,
        );
    });

    it('unpremultiplies translucent RGB before ImageData premultiplies it again', () => {
        assert.deepEqual(
            [
                ...flipCapturePixelRows(
                    new Uint8Array([64, 32, 16, 128, 200, 150, 100, 0]),
                    2,
                    1,
                    true,
                ),
            ],
            [128, 64, 32, 128, 0, 0, 0, 0],
        );
    });

    it('requires the capture-owned preserved drawing buffer', () => {
        assert.equal(
            resolveCaptureContextUnpremultiplyAlpha({
                premultipliedAlpha: true,
                preserveDrawingBuffer: true,
            }),
            true,
        );
        assert.equal(
            resolveCaptureContextUnpremultiplyAlpha({
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
            }),
            false,
        );
        assert.throws(
            () =>
                resolveCaptureContextUnpremultiplyAlpha({
                    preserveDrawingBuffer: false,
                }),
            /preserved WebGL drawing buffer/,
        );
        assert.throws(
            () => resolveCaptureContextUnpremultiplyAlpha(null),
            /preserved WebGL drawing buffer/,
        );
    });

    it('maps fence statuses without treating a timeout poll as failure', () => {
        assert.equal(
            resolveCaptureFencePollOutcome({
                alreadySignaled: 3,
                conditionSatisfied: 4,
                status: 1,
                timeoutExpired: 1,
                waitFailed: 2,
            }),
            'waiting',
        );
        assert.equal(
            resolveCaptureFencePollOutcome({
                alreadySignaled: 3,
                conditionSatisfied: 4,
                status: 2,
                timeoutExpired: 1,
                waitFailed: 2,
            }),
            'failed',
        );
        assert.equal(
            resolveCaptureFencePollOutcome({
                alreadySignaled: 3,
                conditionSatisfied: 4,
                status: 3,
                timeoutExpired: 1,
                waitFailed: 2,
            }),
            'ready',
        );
        assert.equal(
            resolveCaptureFencePollOutcome({
                alreadySignaled: 3,
                conditionSatisfied: 4,
                status: 99,
                timeoutExpired: 1,
                waitFailed: 2,
            }),
            'failed',
        );
    });

    it('flushes queued commands while polling the fence without blocking', () => {
        const calls: Array<readonly [number, number]> = [];
        const outcome = pollCaptureFence({
            alreadySignaled: 3,
            conditionSatisfied: 4,
            syncFlushCommandsBit: 5,
            timeoutExpired: 1,
            wait: (flags, timeout) => {
                calls.push([flags, timeout]);
                return 1;
            },
            waitFailed: 2,
        });

        assert.equal(outcome, 'waiting');
        assert.deepEqual(calls, [[5, 0]]);
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
