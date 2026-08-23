import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { resolveGameCameraInitialView } from './gameCameraInitialView';

describe('resolveGameCameraInitialView', () => {
    it('uses the garden scene defaults when there is no saved home camera', () => {
        const initialPosition = new Vector3(-80, 90, -70);
        const initialTarget = new Vector3(4, 0, 6);

        const view = resolveGameCameraInitialView({
            initialPosition,
            initialTarget,
            initialZoom: 75,
        });

        assert.deepEqual(view.position.toArray(), [-80, 90, -70]);
        assert.deepEqual(view.target.toArray(), [4, 0, 6]);
        assert.equal(view.zoom, 75);
        assert.notEqual(view.position, initialPosition);
        assert.notEqual(view.target, initialTarget);
    });

    it('prefers the saved garden home camera', () => {
        const view = resolveGameCameraInitialView({
            initialPosition: new Vector3(-100, 100, -100),
            initialSnapshot: {
                position: [12, 80, -18],
                target: [4, 0, -6],
                zoom: 140,
            },
            initialTarget: new Vector3(0, 0, 0),
            initialZoom: 100,
        });

        assert.deepEqual(view.position.toArray(), [12, 80, -18]);
        assert.deepEqual(view.target.toArray(), [4, 0, -6]);
        assert.equal(view.zoom, 140);
    });
});
