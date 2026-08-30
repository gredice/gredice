import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OrthographicCamera, Vector3 } from 'three';
import {
    getPreservedAngleCameraPosition,
    getScreenPositionAdjustedCameraTarget,
    resolvePreservedAngleCloseupZoom,
    shouldGameCameraOwnPointerGesture,
    shouldUseImmediateGameCameraTransition,
} from './GameCameraRig';

describe('camera pointer arbitration', () => {
    it('reserves one pointer for paint tools while preserving two-finger navigation', () => {
        assert.equal(shouldGameCameraOwnPointerGesture(0, false), false);
        assert.equal(shouldGameCameraOwnPointerGesture(1, false), false);
        assert.equal(shouldGameCameraOwnPointerGesture(2, false), true);
        assert.equal(shouldGameCameraOwnPointerGesture(1, true), true);
        assert.equal(shouldGameCameraOwnPointerGesture(2, true), true);
    });
});

describe('camera motion preference', () => {
    it('makes structure focus and restore immediate for reduced motion', () => {
        assert.equal(shouldUseImmediateGameCameraTransition(0.65, true), true);
        assert.equal(shouldUseImmediateGameCameraTransition(0, false), true);
        assert.equal(
            shouldUseImmediateGameCameraTransition(0.65, false),
            false,
        );
    });
});

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

    it('places a focused point at the requested normalized canvas position', () => {
        const viewportWidth = 844;
        const viewportHeight = 390;
        const zoom = 42;
        const screenPosition = { x: 0.74, y: 0.525 };
        const focusTarget = new Vector3(1, 0.5, 2);
        const cameraOffset = new Vector3(-100, 100, -100);
        const camera = new OrthographicCamera(
            -viewportWidth / 2,
            viewportWidth / 2,
            viewportHeight / 2,
            -viewportHeight / 2,
        );
        camera.position.copy(focusTarget).add(cameraOffset);
        camera.lookAt(focusTarget);
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        const adjustedTarget = getScreenPositionAdjustedCameraTarget({
            camera,
            focusTarget,
            screenPosition,
            viewportHeight,
            viewportWidth,
            zoom,
        });
        camera.position.copy(adjustedTarget).add(cameraOffset);
        camera.lookAt(adjustedTarget);
        camera.updateMatrixWorld();
        const projected = focusTarget.clone().project(camera);

        assert.ok(Math.abs((projected.x + 1) / 2 - screenPosition.x) < 1e-6);
        assert.ok(Math.abs((-projected.y + 1) / 2 - screenPosition.y) < 1e-6);
    });

    it('zooms in to the requested closeup without zooming out an existing view', () => {
        assert.equal(resolvePreservedAngleCloseupZoom(90, 240), 240);
        assert.equal(resolvePreservedAngleCloseupZoom(320, 240), 320);
    });
});
