import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    type Camera,
    OrthographicCamera,
    PerspectiveCamera,
    Plane,
    Raycaster,
    Vector2,
    Vector3,
} from 'three';
import {
    defaultGameCameraPosition,
    defaultGameCameraTarget,
} from '../gameCamera';
import {
    computeMenuMoveAnchorOffset,
    type PickupAnchorOffset,
    type PickupClientPoint,
    type PickupClientRect,
    resolveMenuMoveStartPoint,
} from './blockMoveAnchor';

const pickupLift = 0.1;
const placementSnapSearchRadius = 5;
const rect: PickupClientRect = { left: 40, top: 24, width: 960, height: 640 };

function createGameCamera(zoom = 65) {
    // The game's orthographic camera as r3f sets it up for the canvas size.
    const camera = new OrthographicCamera(
        -rect.width / 2,
        rect.width / 2,
        rect.height / 2,
        -rect.height / 2,
        0.1,
        1000,
    );
    camera.zoom = zoom;
    camera.position.set(...defaultGameCameraPosition);
    camera.lookAt(...defaultGameCameraTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return camera;
}

function createPerspectiveCamera() {
    const camera = new PerspectiveCamera(
        45,
        rect.width / rect.height,
        0.1,
        200,
    );
    camera.position.set(-12, 14, -12);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return camera;
}

function project(
    camera: Camera,
    position: { x: number; y: number; z: number },
): PickupClientPoint {
    const projected = new Vector3(position.x, position.y, position.z).project(
        camera,
    );
    return {
        clientX: rect.left + ((projected.x + 1) / 2) * rect.width,
        clientY: rect.top + ((1 - projected.y) / 2) * rect.height,
    };
}

/**
 * The snapping of `PickableGroup` / `InstancedBlockInteractionController`
 * `resolvePlacementPreview`, with a stub resolver: every candidate cell is
 * valid and flat (`previewHoverHeight` 0). The ground point under the
 * pointer minus the anchor seeds a ±5 search; the candidate whose anchored
 * point at the lifted height projects closest to the pointer wins.
 */
function resolveSnappedCell({
    anchor,
    camera,
    pointer,
    stack,
    stackHeight,
}: {
    anchor: PickupAnchorOffset;
    camera: Camera;
    pointer: PickupClientPoint;
    stack: { x: number; z: number };
    stackHeight: number;
}) {
    const raycaster = new Raycaster();
    raycaster.setFromCamera(
        new Vector2(
            ((pointer.clientX - rect.left) / rect.width) * 2 - 1,
            ((rect.top - pointer.clientY) / rect.height) * 2 + 1,
        ),
        camera,
    );
    const ground = raycaster.ray.intersectPlane(
        new Plane(new Vector3(0, 1, 0), 0),
        new Vector3(),
    );
    assert.ok(ground, 'the pointer ray meets the ground');
    const seed = {
        x: Math.round(ground.x - anchor.x),
        z: Math.round(ground.z - anchor.z),
    };
    const candidates = [{ x: stack.x, z: stack.z }];
    for (
        let dx = -placementSnapSearchRadius;
        dx <= placementSnapSearchRadius;
        dx++
    ) {
        for (
            let dz = -placementSnapSearchRadius;
            dz <= placementSnapSearchRadius;
            dz++
        ) {
            candidates.push({ x: seed.x + dx, z: seed.z + dz });
        }
    }

    let best: { x: number; z: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        const point = project(camera, {
            x: candidate.x + anchor.x,
            y: stackHeight + pickupLift + anchor.y,
            z: candidate.z + anchor.z,
        });
        const distance =
            (point.clientX - pointer.clientX) ** 2 +
            (point.clientY - pointer.clientY) ** 2;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }

    return best;
}

for (const [label, createCamera] of [
    ['orthographic game camera', () => createGameCamera()],
    ['perspective camera', () => createPerspectiveCamera()],
] as const) {
    test(`the anchor at the lifted base projects back to the pointer (${label})`, () => {
        const camera = createCamera();
        const stack = { x: 2, z: -1 };
        const stackHeight = 0.6;
        // The pop-up's Pomakni button sits well above the block on screen.
        const blockPoint = project(camera, { x: 2, y: stackHeight, z: -1 });
        const pointer = {
            clientX: blockPoint.clientX + 24,
            clientY: blockPoint.clientY - 90,
        };

        const anchor = computeMenuMoveAnchorOffset({
            camera,
            planeHeight: stackHeight + pickupLift,
            pointer,
            rect,
            stackPosition: stack,
        });

        assert.equal(anchor.y, 0);
        const back = project(camera, {
            x: stack.x + anchor.x,
            y: stackHeight + pickupLift,
            z: stack.z + anchor.z,
        });
        assert.ok(Math.abs(back.clientX - pointer.clientX) < 1e-6);
        assert.ok(Math.abs(back.clientY - pointer.clientY) < 1e-6);
    });
}

test('a pointer that has not moved resolves to the source cell', () => {
    const camera = createGameCamera();
    const stack = { x: 0, z: 0 };
    const stackHeight = 0.25;
    const blockPoint = project(camera, { x: 0, y: stackHeight, z: 0 });
    const pointer = {
        clientX: blockPoint.clientX,
        clientY: blockPoint.clientY - 70,
    };
    const anchor = computeMenuMoveAnchorOffset({
        camera,
        planeHeight: stackHeight + pickupLift,
        pointer,
        rect,
        stackPosition: stack,
    });

    assert.deepEqual(
        resolveSnappedCell({ anchor, camera, pointer, stack, stackHeight }),
        stack,
    );
    // An 8 px wobble stays on the source cell too (spec #16).
    for (const [dx, dy] of [
        [8, 0],
        [0, 8],
        [-6, -5],
    ]) {
        assert.deepEqual(
            resolveSnappedCell({
                anchor,
                camera,
                pointer: {
                    clientX: pointer.clientX + dx,
                    clientY: pointer.clientY + dy,
                },
                stack,
                stackHeight,
            }),
            stack,
        );
    }

    // Without the anchor the block would jump to the cell under the button.
    const unanchored = resolveSnappedCell({
        anchor: { x: 0, y: 0, z: 0 },
        camera,
        pointer,
        stack,
        stackHeight,
    });
    assert.notDeepEqual(unanchored, stack);
});

test('dragging by two cells on screen moves the block two cells', () => {
    const camera = createGameCamera();
    const stack = { x: -1, z: 2 };
    const stackHeight = 0.25;
    const from = project(camera, { x: -1, y: stackHeight, z: 2 });
    const pointer = { clientX: from.clientX - 12, clientY: from.clientY - 64 };
    const anchor = computeMenuMoveAnchorOffset({
        camera,
        planeHeight: stackHeight + pickupLift,
        pointer,
        rect,
        stackPosition: stack,
    });
    const twoCells = project(camera, { x: 1, y: stackHeight, z: 2 });

    assert.deepEqual(
        resolveSnappedCell({
            anchor,
            camera,
            pointer: {
                clientX: pointer.clientX + (twoCells.clientX - from.clientX),
                clientY: pointer.clientY + (twoCells.clientY - from.clientY),
            },
            stack,
            stackHeight,
        }),
        { x: 1, z: 2 },
    );
});

test('without a pointer, or with an empty canvas, the block is held at its centre', () => {
    const camera = createGameCamera();
    assert.deepEqual(
        computeMenuMoveAnchorOffset({
            camera,
            planeHeight: 0.35,
            pointer: null,
            rect,
            stackPosition: { x: 3, z: 3 },
        }),
        { x: 0, y: 0, z: 0 },
    );
    assert.deepEqual(
        computeMenuMoveAnchorOffset({
            camera,
            planeHeight: 0.35,
            pointer: { clientX: 100, clientY: 100 },
            rect: { ...rect, width: 0 },
            stackPosition: { x: 3, z: 3 },
        }),
        { x: 0, y: 0, z: 0 },
    );
});

test('a ray parallel to the plane falls back to the centre', () => {
    const camera = new PerspectiveCamera(45, rect.width / rect.height, 0.1, 50);
    camera.position.set(0, 1, 0);
    camera.lookAt(10, 1, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const centre = {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
    };

    assert.deepEqual(
        computeMenuMoveAnchorOffset({
            camera,
            planeHeight: 1,
            pointer: centre,
            rect,
            stackPosition: { x: 0, z: 0 },
        }),
        { x: 0, y: 0, z: 0 },
    );
});

test('a move from the pointer starts at the pointer', () => {
    const camera = createGameCamera();
    assert.deepEqual(
        resolveMenuMoveStartPoint({
            camera,
            planeHeight: 0.35,
            pointer: { clientX: 123, clientY: 456 },
            rect,
            stackPosition: { x: 2, z: -2 },
        }),
        { clientX: 123, clientY: 456 },
    );
});

for (const [label, createCamera] of [
    ['orthographic game camera', () => createGameCamera()],
    ['perspective camera', () => createPerspectiveCamera()],
] as const) {
    test(`a keyboard move starts on the block and resolves to its own cell (${label})`, () => {
        const camera = createCamera();
        const centre = {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
        };
        // Blocks away from the canvas centre, flat and raised.
        for (const { stack, stackHeight } of [
            { stack: { x: 2, z: -2 }, stackHeight: 0.4 },
            { stack: { x: 2, z: 0 }, stackHeight: 0.4 },
            { stack: { x: -3, z: 2 }, stackHeight: 1.2 },
        ]) {
            const planeHeight = stackHeight + pickupLift;
            const start = resolveMenuMoveStartPoint({
                camera,
                planeHeight,
                pointer: null,
                rect,
                stackPosition: stack,
            });
            const anchor = computeMenuMoveAnchorOffset({
                camera,
                planeHeight,
                pointer: null,
                rect,
                stackPosition: stack,
            });

            assert.deepEqual(
                start,
                project(camera, { x: stack.x, y: planeHeight, z: stack.z }),
            );
            assert.deepEqual(
                resolveSnappedCell({
                    anchor,
                    camera,
                    pointer: start,
                    stack,
                    stackHeight,
                }),
                stack,
            );
            // The canvas centre (the old start point) is another cell.
            assert.notDeepEqual(
                resolveSnappedCell({
                    anchor,
                    camera,
                    pointer: centre,
                    stack,
                    stackHeight,
                }),
                stack,
            );
        }
    });
}

test('a keyboard move falls back to the canvas centre when the block cannot be projected', () => {
    const centre = {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
    };
    assert.deepEqual(
        resolveMenuMoveStartPoint({
            camera: createGameCamera(),
            planeHeight: 0.35,
            pointer: null,
            rect: { ...rect, height: 0 },
            stackPosition: { x: 1, z: 1 },
        }),
        { clientX: rect.left + rect.width / 2, clientY: rect.top },
    );

    // Behind a perspective camera that looks along +x.
    const camera = new PerspectiveCamera(45, rect.width / rect.height, 0.1, 50);
    camera.position.set(0, 1, 0);
    camera.lookAt(10, 1, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    assert.deepEqual(
        resolveMenuMoveStartPoint({
            camera,
            planeHeight: 1,
            pointer: null,
            rect,
            stackPosition: { x: -5, z: 0 },
        }),
        centre,
    );
});
