import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    maximumSceneFramesPerSecond,
    normalizeSceneFramesPerSecond,
    resolveSceneFramesPerSecond,
    resolveSceneFrameTick,
    resolveSceneVisibility,
} from './sceneFrameScheduler';

describe('normalizeSceneFramesPerSecond', () => {
    it('disables invalid and non-positive frame rates', () => {
        assert.equal(normalizeSceneFramesPerSecond(Number.NaN), 0);
        assert.equal(normalizeSceneFramesPerSecond(0), 0);
        assert.equal(normalizeSceneFramesPerSecond(-1), 0);
    });

    it('keeps valid rates within the scene maximum', () => {
        assert.equal(normalizeSceneFramesPerSecond(30), 30);
        assert.equal(
            normalizeSceneFramesPerSecond(120),
            maximumSceneFramesPerSecond,
        );
    });
});

describe('resolveSceneFramesPerSecond', () => {
    it('uses the ambient frame rate without active leases', () => {
        assert.equal(resolveSceneFramesPerSecond(30, []), 30);
    });

    it('uses the highest active lease and restores the base after release', () => {
        const leases = new Map<symbol, number>();
        const ambientLease = Symbol('ambient');
        const interactionLease = Symbol('interaction');

        leases.set(ambientLease, 30);
        leases.set(interactionLease, 60);
        assert.equal(resolveSceneFramesPerSecond(30, leases.values()), 60);

        leases.delete(interactionLease);
        assert.equal(resolveSceneFramesPerSecond(30, leases.values()), 30);
    });
});

describe('resolveSceneVisibility', () => {
    it('suspends ordinary scenes when their canvas is offscreen', () => {
        assert.equal(
            resolveSceneVisibility({
                canvasVisible: false,
                documentVisible: true,
                suspendWhenOffscreen: true,
            }),
            false,
        );
    });

    it('allows an offscreen capture scene while the document is visible', () => {
        assert.equal(
            resolveSceneVisibility({
                canvasVisible: false,
                documentVisible: true,
                suspendWhenOffscreen: false,
            }),
            true,
        );
    });

    it('always suspends when the document is hidden', () => {
        assert.equal(
            resolveSceneVisibility({
                canvasVisible: true,
                documentVisible: false,
                suspendWhenOffscreen: false,
            }),
            false,
        );
    });
});

describe('resolveSceneFrameTick', () => {
    it('renders the first frame and then follows the requested cadence', () => {
        const firstFrame = resolveSceneFrameTick({
            framesPerSecond: 30,
            lastFrameTimestamp: null,
            timestamp: 0,
        });
        assert.deepEqual(firstFrame, {
            lastFrameTimestamp: 0,
            shouldRender: true,
        });

        const earlyFrame = resolveSceneFrameTick({
            framesPerSecond: 30,
            lastFrameTimestamp: firstFrame.lastFrameTimestamp,
            timestamp: 16.7,
        });
        assert.equal(earlyFrame.shouldRender, false);

        const dueFrame = resolveSceneFrameTick({
            framesPerSecond: 30,
            lastFrameTimestamp: earlyFrame.lastFrameTimestamp,
            timestamp: 33.3,
        });
        assert.equal(dueFrame.shouldRender, true);
    });

    it('does not emit catch-up frames after a long stall', () => {
        const resumedFrame = resolveSceneFrameTick({
            framesPerSecond: 30,
            lastFrameTimestamp: 0,
            timestamp: 1000,
        });
        assert.deepEqual(resumedFrame, {
            lastFrameTimestamp: 1000,
            shouldRender: true,
        });

        const immediateNextFrame = resolveSceneFrameTick({
            framesPerSecond: 30,
            lastFrameTimestamp: resumedFrame.lastFrameTimestamp,
            timestamp: 1001,
        });
        assert.equal(immediateNextFrame.shouldRender, false);
    });

    it('does not render when scheduling is disabled', () => {
        assert.deepEqual(
            resolveSceneFrameTick({
                framesPerSecond: 0,
                lastFrameTimestamp: null,
                timestamp: 10,
            }),
            {
                lastFrameTimestamp: null,
                shouldRender: false,
            },
        );
    });
});
