import assert from 'node:assert/strict';
import test from 'node:test';
import { Object3D, Vector3 } from 'three';
import { animateGardenAvatarRig } from './GardenAvatar';

function createAvatarRig() {
    const armLeft = new Object3D();
    const armRight = new Object3D();
    const body = new Object3D();
    const head = new Object3D();
    const legLeft = new Object3D();
    const legRight = new Object3D();
    const kneeLeft = new Object3D();
    const kneeRight = new Object3D();
    const footLeft = new Object3D();
    const footRight = new Object3D();

    kneeLeft.position.y = -0.3;
    kneeRight.position.y = -0.3;
    footLeft.position.y = -0.3;
    footRight.position.y = -0.3;
    legLeft.add(kneeLeft);
    legRight.add(kneeRight);
    kneeLeft.add(footLeft);
    kneeRight.add(footRight);

    return {
        footLeft,
        footRight,
        rig: {
            armLeft,
            armRight,
            body,
            elbowLeft: new Object3D(),
            elbowRight: new Object3D(),
            head,
            kneeLeft,
            kneeRight,
            legLeft,
            legRight,
            restY: {
                armLeft: armLeft.position.y,
                armRight: armRight.position.y,
                body: body.position.y,
                head: head.position.y,
                legLeft: legLeft.position.y,
                legRight: legRight.position.y,
            },
        },
    };
}

test('seated avatar bends both legs forward with lower legs hanging down', () => {
    const { footLeft, footRight, rig } = createAvatarRig();

    animateGardenAvatarRig({
        crouchAmount: 1,
        delta: 1,
        distanceWalked: 0,
        grounded: true,
        headPitch: 0,
        rig,
        seated: true,
        walkAmount: 0,
    });

    assert.ok(rig.legLeft.rotation.x > 1);
    assert.ok(rig.legRight.rotation.x > 1);
    assert.ok(rig.kneeLeft.rotation.x < -1);
    assert.ok(rig.kneeRight.rotation.x < -1);
    assert.ok(rig.elbowLeft.rotation.x < -0.3);
    assert.ok(rig.elbowRight.rotation.x < -0.3);

    rig.legLeft.updateWorldMatrix(true, true);
    rig.legRight.updateWorldMatrix(true, true);
    const leftKneePosition = rig.kneeLeft.getWorldPosition(new Vector3());
    const rightKneePosition = rig.kneeRight.getWorldPosition(new Vector3());
    const leftFootPosition = footLeft.getWorldPosition(new Vector3());
    const rightFootPosition = footRight.getWorldPosition(new Vector3());

    assert.ok(leftKneePosition.z < 0);
    assert.ok(rightKneePosition.z < 0);
    assert.ok(leftFootPosition.z < 0);
    assert.ok(rightFootPosition.z < 0);
    assert.ok(leftFootPosition.y < leftKneePosition.y);
    assert.ok(rightFootPosition.y < rightKneePosition.y);
});
