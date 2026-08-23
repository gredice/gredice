import assert from 'node:assert/strict';
import test from 'node:test';
import {
    Object3D,
    OrthographicCamera,
    PerspectiveCamera,
    Vector3,
} from 'three';
import {
    getGardenAvatarPerspectiveEntryPosition,
    getGardenAvatarThirdPersonCameraDistance,
    getGardenAvatarThirdPersonCameraTargetHeight,
} from './gardenAvatarCamera';

test('keeps the third-person camera farther back on portrait screens', () => {
    const landscapeDistance = getGardenAvatarThirdPersonCameraDistance({
        aspect: 16 / 9,
        crouchAmount: 0,
    });
    const portraitDistance = getGardenAvatarThirdPersonCameraDistance({
        aspect: 9 / 16,
        crouchAmount: 0,
    });

    assert.equal(landscapeDistance, 3.05);
    assert.ok(Math.abs(portraitDistance - 3.6) < 0.000_001);
    assert.ok(portraitDistance > landscapeDistance);
});

test('clamps third-person camera framing inputs', () => {
    assert.ok(
        Math.abs(
            getGardenAvatarThirdPersonCameraDistance({
                aspect: 9 / 16,
                crouchAmount: 2,
            }) - 3.35,
        ) < 0.000_001,
    );
    assert.equal(
        getGardenAvatarThirdPersonCameraDistance({
            aspect: 0,
            crouchAmount: -1,
        }),
        3.05,
    );
    assert.equal(getGardenAvatarThirdPersonCameraTargetHeight(-1), 1.08);
    assert.equal(getGardenAvatarThirdPersonCameraTargetHeight(2), 0.82);
});

test('matches the overview framing when entering the perspective camera', () => {
    const aspect = 16 / 9;
    const halfHeight = 3.6;
    const actor = new Object3D();
    actor.position.set(0.7, 0.4, -0.5);
    actor.updateMatrixWorld();

    const overview = new OrthographicCamera(
        -halfHeight * aspect,
        halfHeight * aspect,
        halfHeight,
        -halfHeight,
        0.01,
        10_000,
    );
    overview.position.set(-100, 100, -100);
    overview.lookAt(0, 0, 0);
    overview.updateProjectionMatrix();
    overview.updateMatrixWorld();
    const overviewScreenPosition = actor.position.clone().project(overview);

    const perspectiveFov = 55;
    const entryPosition = getGardenAvatarPerspectiveEntryPosition({
        actor,
        camera: overview,
        perspectiveFov,
        target: new Vector3(),
    });
    const perspective = new PerspectiveCamera(
        perspectiveFov,
        aspect,
        0.05,
        10_000,
    );
    perspective.position.copy(entryPosition);
    perspective.quaternion.copy(overview.quaternion);
    perspective.updateProjectionMatrix();
    perspective.updateMatrixWorld();
    const perspectiveScreenPosition = actor.position
        .clone()
        .project(perspective);

    assert.ok(
        Math.abs(perspectiveScreenPosition.x - overviewScreenPosition.x) <
            0.000_001,
    );
    assert.ok(
        Math.abs(perspectiveScreenPosition.y - overviewScreenPosition.y) <
            0.000_001,
    );
    assert.ok(entryPosition.distanceTo(actor.position) < 10);
});

test('keeps an existing perspective camera position unchanged', () => {
    const actor = new Object3D();
    const camera = new PerspectiveCamera(55, 1, 0.05, 10_000);
    camera.position.set(2, 3, 4);
    camera.updateMatrixWorld();
    const target = new Vector3();

    assert.equal(
        getGardenAvatarPerspectiveEntryPosition({
            actor,
            camera,
            perspectiveFov: 55,
            target,
        }),
        target,
    );
    assert.deepEqual(target.toArray(), [2, 3, 4]);
});
