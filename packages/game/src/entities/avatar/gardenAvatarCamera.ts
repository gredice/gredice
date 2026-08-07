import {
    MathUtils,
    type Object3D,
    type OrthographicCamera,
    PerspectiveCamera,
    type Vector3,
} from 'three';

export function getGardenAvatarPerspectiveEntryPosition({
    actor,
    camera,
    perspectiveFov,
    target,
}: {
    actor: Object3D;
    camera: OrthographicCamera | PerspectiveCamera;
    perspectiveFov: number;
    target: Vector3;
}) {
    camera.getWorldPosition(target);
    if (camera instanceof PerspectiveCamera) {
        return target;
    }

    const forward = camera.getWorldDirection(target.clone());
    const actorWorldPosition = actor.getWorldPosition(target.clone());
    const actorDepth = forward.dot(actorWorldPosition.sub(target));
    const halfHeight = (camera.top - camera.bottom) / (2 * camera.zoom);
    const matchingPerspectiveDepth =
        halfHeight / Math.tan(MathUtils.degToRad(perspectiveFov) / 2);
    return target.addScaledVector(
        forward,
        actorDepth - matchingPerspectiveDepth,
    );
}
