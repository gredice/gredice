import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import {
    getPreservedAngleCameraPosition,
    resolvePreservedAngleCloseupZoom,
} from './GameCameraRig';

describe('preserved-angle camera focus', () => {
    it('pans to a new target without changing the camera viewing offset', () => {
        const cameraPosition = new Vector3(-97, 100, -93);
        const cameraTarget = new Vector3(3, 0, 7);
        const focusTarget = new Vector3(14, 1.4, 22);

        const focusedPosition = getPreservedAngleCameraPosition({
            cameraPosition,
            cameraTarget,
            focusTarget,
        });

        assert.deepEqual(
            focusedPosition.clone().sub(focusTarget).toArray(),
            cameraPosition.clone().sub(cameraTarget).toArray(),
        );
        assert.deepEqual(cameraPosition.toArray(), [-97, 100, -93]);
        assert.deepEqual(cameraTarget.toArray(), [3, 0, 7]);
        assert.deepEqual(focusTarget.toArray(), [14, 1.4, 22]);
    });

    it('zooms in to the requested closeup without zooming out an existing view', () => {
        assert.equal(resolvePreservedAngleCloseupZoom(90, 240), 240);
        assert.equal(resolvePreservedAngleCloseupZoom(320, 240), 320);
    });
});
