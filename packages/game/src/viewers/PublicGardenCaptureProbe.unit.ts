import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCaptureCameraZoom } from './PublicGardenCaptureProbe';

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
