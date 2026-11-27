import { type Camera, Plane, Raycaster, Vector2, Vector3 } from 'three';

/**
 * Where the pointer holds a lifted block, relative to its stack cell. The
 * placement resolver subtracts it from the ground point under the pointer
 * and scores candidate cells by how close `candidate + offset` projects to
 * the pointer (`PickableGroup` and `InstancedBlockInteractionController`,
 * `resolvePlacementPreview`).
 */
export type PickupAnchorOffset = {
    x: number;
    y: number;
    z: number;
};

export type PickupClientRect = Pick<
    DOMRect,
    'height' | 'left' | 'top' | 'width'
>;

export type PickupClientPoint = {
    clientX: number;
    clientY: number;
};

/** The anchor of a carried block: the block goes where the player taps. */
export const centeredPickupAnchorOffset: Readonly<PickupAnchorOffset> =
    Object.freeze({ x: 0, y: 0, z: 0 });

const upNormal = new Vector3(0, 1, 0);
const anchorPlane = new Plane();
const anchorRaycaster = new Raycaster();
const anchorPointer = new Vector2();
const anchorHit = new Vector3();
const startPointProjected = new Vector3();

/**
 * Where a move started from the pop-up's Pomakni button begins on screen:
 * the pointer that pressed the button, or, without one (keyboard), the
 * lifted block's base (`stackPosition` at `planeHeight`) projected to the
 * screen. The resolver re-reads the session's client point when the pickup
 * starts, so a keyboard move resolves to the source cell until a pointer
 * hovers or adopts the carry; the canvas centre would make the block jump
 * to the cell there. Falls back to the canvas centre only when the block
 * cannot be projected (empty canvas, behind the camera).
 */
export function resolveMenuMoveStartPoint({
    camera,
    planeHeight,
    pointer,
    rect,
    stackPosition,
}: {
    camera: Camera;
    planeHeight: number;
    pointer: PickupClientPoint | null;
    rect: PickupClientRect;
    stackPosition: { x: number; z: number };
}): PickupClientPoint {
    if (pointer) {
        return { clientX: pointer.clientX, clientY: pointer.clientY };
    }

    const centre = {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
    };
    if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(planeHeight)) {
        return centre;
    }

    // Same screen mapping as the resolver's candidate scoring.
    const projected = startPointProjected
        .set(stackPosition.x, planeHeight, stackPosition.z)
        .project(camera);
    if (
        !Number.isFinite(projected.x) ||
        !Number.isFinite(projected.y) ||
        projected.z < -1 ||
        projected.z > 1
    ) {
        return centre;
    }

    return {
        clientX: rect.left + ((projected.x + 1) / 2) * rect.width,
        clientY: rect.top + ((1 - projected.y) / 2) * rect.height,
    };
}

/**
 * The anchor offset for a move started from the pop-up's Pomakni button,
 * whose pointer is not on the block. The ray through the pointer meets the
 * horizontal plane at `planeHeight` (the lifted block's base: stack height
 * plus the pickup lift), the height at which the resolver scores candidates.
 * So `stack + offset` at that height projects exactly to the pointer, and a
 * pointer that has not moved resolves to the source cell. A zero offset
 * would make the block jump to the cell under the button.
 *
 * Without a pointer (keyboard), or when the ray cannot meet the plane, the
 * block is held at its centre.
 */
export function computeMenuMoveAnchorOffset({
    camera,
    planeHeight,
    pointer,
    rect,
    stackPosition,
}: {
    camera: Camera;
    planeHeight: number;
    pointer: PickupClientPoint | null;
    rect: PickupClientRect;
    stackPosition: { x: number; z: number };
}): PickupAnchorOffset {
    if (
        !pointer ||
        rect.width <= 0 ||
        rect.height <= 0 ||
        !Number.isFinite(planeHeight)
    ) {
        return { ...centeredPickupAnchorOffset };
    }

    // Same NDC mapping as the resolver's ground ray.
    anchorPointer.set(
        ((pointer.clientX - rect.left) / rect.width) * 2 - 1,
        ((rect.top - pointer.clientY) / rect.height) * 2 + 1,
    );
    anchorRaycaster.setFromCamera(anchorPointer, camera);
    anchorPlane.set(upNormal, -planeHeight);
    const hit = anchorRaycaster.ray.intersectPlane(anchorPlane, anchorHit);
    if (!hit) {
        return { ...centeredPickupAnchorOffset };
    }

    return {
        x: hit.x - stackPosition.x,
        y: 0,
        z: hit.z - stackPosition.z,
    };
}
