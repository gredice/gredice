import {
    type Camera,
    Plane,
    type Ray,
    Raycaster,
    Vector2,
    Vector3,
} from 'three';
import {
    type DragEdgeAutopanPointer,
    dragEdgeAutopanPushPx,
    isDragEdgeAutopanArmed,
} from '../../controls/dragEdgeAutopan';

/** A garden cell in world axes (`z` is the garden's depth axis). */
export type ExpandCell = { x: number; z: number };

/** A canvas rectangle in client coordinates. */
export type ExpandPointerRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

// Same start distances as a HUD item drag (`ItemsHud.tsx`) and a block
// pickup (`instancedBlockInteractionCore.ts`): a mouse is precise, a finger
// wobbles.
const mouseStartDistancePx = 6;
const touchStartDistancePx = 12;

/** A press that lasts longer than this is a hold, not a tap. */
export const expandTapMaxDurationMs = 500;

/** Pixels a press must travel before it counts as a drag (6 mouse, 12 touch). */
export function getExpandPointerStartDistance(pointerType: string) {
    return pointerType === 'touch'
        ? touchStartDistancePx
        : mouseStartDistancePx;
}

/** Whether a press has moved far enough from where it started to drag. */
export function hasExpandPointerTravelled({
    pointerType,
    travelPx,
}: {
    pointerType: string;
    travelPx: number;
}) {
    return travelPx >= getExpandPointerStartDistance(pointerType);
}

/**
 * Whether a press on the canvas was a tap that sets the corner: it never
 * travelled the drag start distance and it was released quickly. Anything
 * else (a pan, a pinch, a hold) leaves the corner alone.
 */
export function isExpandTap({
    durationMs,
    pointerType,
    travelPx,
}: {
    durationMs: number;
    pointerType: string;
    travelPx: number;
}) {
    return (
        Number.isFinite(durationMs) &&
        durationMs >= 0 &&
        durationMs < expandTapMaxDurationMs &&
        !hasExpandPointerTravelled({ pointerType, travelPx })
    );
}

const scratchPlane = new Plane(new Vector3(0, 1, 0), 0);
const scratchPoint = new Vector3();
const scratchNdc = new Vector2();
const scratchRaycaster = new Raycaster();

/**
 * The cell a ray crosses on the horizontal plane `y = planeHeight`, or null
 * when the ray runs parallel to it or points away from it.
 */
export function getExpandCellOnPlane(
    ray: Ray,
    planeHeight: number,
): ExpandCell | null {
    if (!Number.isFinite(planeHeight)) {
        return null;
    }

    scratchPlane.constant = -planeHeight;
    const hit = ray.intersectPlane(scratchPlane, scratchPoint);
    if (!hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.z)) {
        return null;
    }

    return { x: Math.round(hit.x) + 0, z: Math.round(hit.z) + 0 };
}

/**
 * The cell under a client point on the plane `y = planeHeight`. The handle
 * drags on the plane its knob sits on, so the knob stays under the pointer;
 * a tap on the canvas uses the surface the copies stand on.
 */
export function getExpandPointerCell({
    camera,
    clientX,
    clientY,
    planeHeight,
    rect,
}: {
    camera: Camera;
    clientX: number;
    clientY: number;
    planeHeight: number;
    rect: ExpandPointerRect;
}): ExpandCell | null {
    if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        !Number.isFinite(clientX) ||
        !Number.isFinite(clientY)
    ) {
        return null;
    }

    scratchNdc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        ((rect.top - clientY) / rect.height) * 2 + 1,
    );
    camera.updateMatrixWorld();
    scratchRaycaster.setFromCamera(scratchNdc, camera);
    return getExpandCellOnPlane(scratchRaycaster.ray, planeHeight);
}

/**
 * The point under a client point on the plane `y = planeHeight`, or null
 * when the ray misses it. A new vector, so callers may keep it.
 */
export function getExpandPointerPlanePoint({
    camera,
    clientX,
    clientY,
    planeHeight,
    rect,
}: {
    camera: Camera;
    clientX: number;
    clientY: number;
    planeHeight: number;
    rect: ExpandPointerRect;
}): Vector3 | null {
    if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        !Number.isFinite(clientX) ||
        !Number.isFinite(clientY) ||
        !Number.isFinite(planeHeight)
    ) {
        return null;
    }

    scratchNdc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        ((rect.top - clientY) / rect.height) * 2 + 1,
    );
    camera.updateMatrixWorld();
    scratchRaycaster.setFromCamera(scratchNdc, camera);
    scratchPlane.constant = -planeHeight;
    const hit = scratchRaycaster.ray.intersectPlane(
        scratchPlane,
        new Vector3(),
    );
    return hit && Number.isFinite(hit.x) && Number.isFinite(hit.z) ? hit : null;
}

/** Screen directions of the arrow keys (x right, y up). */
const arrowScreenDirections: Readonly<
    Record<string, readonly [x: number, y: number]>
> = {
    ArrowUp: [0, 1],
    ArrowRight: [1, 0],
    ArrowDown: [0, -1],
    ArrowLeft: [-1, 0],
};

/** Same as `getWorldRotationAzimuth` in `GameCameraRig.tsx`. */
function getCameraAzimuth(worldRotation: number) {
    return worldRotation * (Math.PI / 2) + Math.PI / 4 + Math.PI;
}

/**
 * The cell step of an arrow key on the Expand handle. The camera looks at
 * the garden along a diagonal, so every grid axis runs diagonally on screen;
 * each arrow is turned 45° clockwise and takes the grid axis it then points
 * along: ArrowUp moves the corner one cell up and to the right on screen,
 * ArrowRight down and to the right. The mapping follows the camera through
 * every world rotation (Q/W), so the keys keep their screen meaning.
 *
 * Returns null for any other key.
 */
export function getExpandArrowCellDelta(
    key: string,
    worldRotation: number,
): ExpandCell | null {
    const direction = arrowScreenDirections[key];
    if (!direction) {
        return null;
    }

    const rotation = Number.isFinite(worldRotation)
        ? Math.round(worldRotation)
        : 0;
    const azimuth = getCameraAzimuth(rotation);
    // Horizontal camera axes: forward runs from the camera to its target,
    // right is forward × up.
    const forwardX = -Math.sin(azimuth);
    const forwardZ = -Math.cos(azimuth);
    const rightX = Math.cos(azimuth);
    const rightZ = -Math.sin(azimuth);
    const [screenX, screenY] = direction;
    // 45° clockwise on screen.
    const turnedX = (screenX + screenY) / Math.SQRT2;
    const turnedY = (screenY - screenX) / Math.SQRT2;
    const worldX = turnedX * rightX + turnedY * forwardX;
    const worldZ = turnedX * rightZ + turnedY * forwardZ;

    return Math.abs(worldX) > Math.abs(worldZ)
        ? { x: Math.sign(worldX), z: 0 }
        : { x: 0, z: Math.sign(worldZ) };
}

/**
 * Whether a requested corner lies beyond the Expand cap: more than
 * `maxSide − 1` cells from the source on either axis, so the store clamps it.
 */
export function isExpandCornerBeyondCap(
    source: ExpandCell,
    requested: ExpandCell,
    maxSide: number,
) {
    const reach = Number.isFinite(maxSide)
        ? Math.max(0, Math.floor(maxSide) - 1)
        : 0;
    return (
        Math.abs(requested.x - source.x) > reach ||
        Math.abs(requested.z - source.z) > reach
    );
}

/** Pixels a knob drag must push further into its start edge band to pan. */
export const expandAutopanPushPx = dragEdgeAutopanPushPx;

/**
 * Whether a knob drag may start the camera's edge autopan. A knob that is
 * already in an edge band when the drag starts (a block near the screen
 * edge, common on phones where the bands cover half the width) would pan the
 * camera at once, whichever way the finger moves, and stretch the rectangle
 * past where the player points. Same rule as a block move from the options
 * pop-up (`isDragEdgeAutopanArmed`).
 */
export function isExpandAutopanArmed({
    pointer,
    start,
    viewport,
}: {
    pointer: DragEdgeAutopanPointer;
    start: DragEdgeAutopanPointer;
    viewport: ExpandPointerRect;
}) {
    return isDragEdgeAutopanArmed({ pointer, start, viewport });
}
