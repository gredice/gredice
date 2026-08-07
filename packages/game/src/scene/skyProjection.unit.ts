import assert from 'node:assert/strict';
import test from 'node:test';
import { OrthographicCamera, PerspectiveCamera } from 'three';
import {
    createSkyCameraProjectionSnapshot,
    updateSkyCameraProjectionSnapshot,
} from './skyProjection';

test('detects orthographic camera transform and projection changes', () => {
    const camera = new OrthographicCamera(-2, 2, 3, -3, 0.1, 100);
    const snapshot = createSkyCameraProjectionSnapshot();

    assert.equal(updateSkyCameraProjectionSnapshot(camera, snapshot), true);
    assert.equal(updateSkyCameraProjectionSnapshot(camera, snapshot), false);

    camera.position.x = 4;
    assert.equal(updateSkyCameraProjectionSnapshot(camera, snapshot), true);
    assert.equal(updateSkyCameraProjectionSnapshot(camera, snapshot), false);

    camera.zoom = 2;
    assert.equal(updateSkyCameraProjectionSnapshot(camera, snapshot), true);
});

test('ignores unsupported perspective cameras', () => {
    assert.equal(
        updateSkyCameraProjectionSnapshot(
            new PerspectiveCamera(),
            createSkyCameraProjectionSnapshot(),
        ),
        false,
    );
});
