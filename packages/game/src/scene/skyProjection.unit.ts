import assert from 'node:assert/strict';
import test from 'node:test';
import { OrthographicCamera, PerspectiveCamera, Vector2, Vector3 } from 'three';
import {
    createSkyCameraProjectionSnapshot,
    createSkyViewBasis,
    projectSkyDirectionToScreen,
    SKY_SCREEN_FRACTION,
    updateSkyCameraProjectionSnapshot,
    updateSkyViewBasis,
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

test('tracks perspective cameras used by garden avatar views', () => {
    const camera = new PerspectiveCamera(55, 16 / 9, 0.05, 10_000);
    const snapshot = createSkyCameraProjectionSnapshot();
    const basis = createSkyViewBasis();

    assert.equal(updateSkyCameraProjectionSnapshot(camera, snapshot), true);
    assert.equal(updateSkyCameraProjectionSnapshot(camera, snapshot), false);
    assert.equal(updateSkyViewBasis(camera, basis), true);
    assert.ok(basis.halfHeight > 0);
    assert.ok(basis.halfWidth > basis.halfHeight);

    camera.fov = 65;
    assert.equal(updateSkyCameraProjectionSnapshot(camera, snapshot), true);
});

test('keeps a stable sky basis while looking straight up', () => {
    const camera = new PerspectiveCamera(55, 1, 0.05, 10_000);
    camera.rotation.x = Math.PI / 2;
    camera.updateMatrixWorld();
    const basis = createSkyViewBasis();

    assert.equal(updateSkyViewBasis(camera, basis), true);
    assert.ok(Number.isFinite(basis.right.x));
    assert.ok(Number.isFinite(basis.viewUp.y));
    assert.ok(Math.abs(basis.right.length() - 1) < 0.000_001);
});

test('perspective sky projection hides celestial directions behind the camera', () => {
    const camera = new PerspectiveCamera(55, 1, 0.05, 10_000);
    const basis = createSkyViewBasis();
    const screen = new Vector2();
    updateSkyViewBasis(camera, basis);

    assert.equal(
        projectSkyDirectionToScreen(new Vector3(0, 0, -1), basis, {}, screen),
        true,
    );
    assert.deepEqual(screen.toArray(), [0, 0]);

    assert.equal(
        projectSkyDirectionToScreen(
            new Vector3(1, 0, -1).normalize(),
            basis,
            {},
            screen,
        ),
        true,
    );
    assert.ok(Math.abs(screen.x - SKY_SCREEN_FRACTION) < 0.000_001);

    assert.equal(
        projectSkyDirectionToScreen(new Vector3(0, 0, 1), basis, {}, screen),
        false,
    );
    assert.ok(screen.x > 1);
    assert.ok(screen.y > 1);
});
