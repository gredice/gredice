import {
    MathUtils,
    type Object3D,
    type OrthographicCamera,
    PerspectiveCamera,
    type Vector3,
} from 'three';

const gardenAvatarThirdPersonStandingDistance = 3.05;
const gardenAvatarThirdPersonCrouchingDistance = 2.8;
const gardenAvatarThirdPersonPortraitDistanceBoost = 0.55;
const gardenAvatarThirdPersonStandingTargetHeight = 1.08;
const gardenAvatarThirdPersonCrouchingTargetHeight = 0.82;

export function getGardenAvatarThirdPersonCameraDistance({
    aspect,
    crouchAmount,
}: {
    aspect: number;
    crouchAmount: number;
}) {
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    const portraitAmount = MathUtils.clamp(
        (1 - safeAspect) / (1 - 9 / 16),
        0,
        1,
    );

    return (
        MathUtils.lerp(
            gardenAvatarThirdPersonStandingDistance,
            gardenAvatarThirdPersonCrouchingDistance,
            MathUtils.clamp(crouchAmount, 0, 1),
        ) +
        gardenAvatarThirdPersonPortraitDistanceBoost * portraitAmount
    );
}

export function getGardenAvatarThirdPersonCameraTargetHeight(
    crouchAmount: number,
) {
    return MathUtils.lerp(
        gardenAvatarThirdPersonStandingTargetHeight,
        gardenAvatarThirdPersonCrouchingTargetHeight,
        MathUtils.clamp(crouchAmount, 0, 1),
    );
}

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
