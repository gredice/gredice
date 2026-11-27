import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OrthographicCamera, Ray, Vector3 } from 'three';
import { defaultGameCameraPosition } from '../../gameCamera';
import {
    type ExpandCell,
    expandAutopanPushPx,
    expandTapMaxDurationMs,
    getExpandArrowCellDelta,
    getExpandCellOnPlane,
    getExpandPointerCell,
    getExpandPointerStartDistance,
    hasExpandPointerTravelled,
    isExpandAutopanArmed,
    isExpandCornerBeyondCap,
    isExpandTap,
} from './expandPointer';

const rect = { left: 12, top: 30, width: 960, height: 640 };

/**
 * An orthographic garden camera like `GameCameraRig`'s: the default offset
 * turned by `worldRotation` quarter turns around `target`.
 */
function createGardenCamera(worldRotation: number, target = new Vector3()) {
    const [offsetX, offsetY, offsetZ] = defaultGameCameraPosition;
    const radius = Math.hypot(offsetX, offsetZ);
    const azimuth = worldRotation * (Math.PI / 2) + Math.PI / 4 + Math.PI;
    const camera = new OrthographicCamera(
        rect.width / -2,
        rect.width / 2,
        rect.height / 2,
        rect.height / -2,
        0.1,
        1000,
    );
    camera.zoom = 65;
    camera.position.set(
        target.x + Math.sin(azimuth) * radius,
        target.y + offsetY,
        target.z + Math.cos(azimuth) * radius,
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return camera;
}

function projectToClient(
    camera: OrthographicCamera,
    point: { x: number; y: number; z: number },
) {
    const projected = new Vector3(point.x, point.y, point.z).project(camera);
    return {
        x: rect.left + ((projected.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - projected.y) / 2) * rect.height,
    };
}

describe('Expand pointer thresholds', () => {
    it('starts a drag after 6 px with a mouse or pen and 12 px with touch', () => {
        assert.equal(getExpandPointerStartDistance('mouse'), 6);
        assert.equal(getExpandPointerStartDistance('pen'), 6);
        assert.equal(getExpandPointerStartDistance('touch'), 12);
        assert.equal(
            hasExpandPointerTravelled({ pointerType: 'mouse', travelPx: 5.9 }),
            false,
        );
        assert.equal(
            hasExpandPointerTravelled({ pointerType: 'mouse', travelPx: 6 }),
            true,
        );
        assert.equal(
            hasExpandPointerTravelled({ pointerType: 'touch', travelPx: 11 }),
            false,
        );
        assert.equal(
            hasExpandPointerTravelled({ pointerType: 'touch', travelPx: 12 }),
            true,
        );
    });

    it('counts a short, still press as a tap and anything else as a pan or hold', () => {
        assert.equal(
            isExpandTap({ durationMs: 120, pointerType: 'mouse', travelPx: 5 }),
            true,
        );
        assert.equal(
            isExpandTap({ durationMs: 120, pointerType: 'mouse', travelPx: 6 }),
            false,
        );
        assert.equal(
            isExpandTap({
                durationMs: 120,
                pointerType: 'touch',
                travelPx: 11,
            }),
            true,
        );
        assert.equal(
            isExpandTap({
                durationMs: 120,
                pointerType: 'touch',
                travelPx: 12,
            }),
            false,
        );
        assert.equal(
            isExpandTap({
                durationMs: expandTapMaxDurationMs - 1,
                pointerType: 'mouse',
                travelPx: 0,
            }),
            true,
        );
        assert.equal(
            isExpandTap({
                durationMs: expandTapMaxDurationMs,
                pointerType: 'mouse',
                travelPx: 0,
            }),
            false,
        );
        assert.equal(
            isExpandTap({
                durationMs: Number.NaN,
                pointerType: 'mouse',
                travelPx: 0,
            }),
            false,
        );
        assert.equal(
            isExpandTap({ durationMs: -1, pointerType: 'mouse', travelPx: 0 }),
            false,
        );
    });
});

describe('getExpandCellOnPlane', () => {
    it('rounds the crossing of a horizontal plane at the given height', () => {
        // Down and away along +x +z at 45°: it drops one unit per unit run.
        const ray = new Ray(
            new Vector3(0.2, 3, -0.1),
            new Vector3(1, -1, 1).normalize(),
        );

        // y = 0.8 is crossed after 2.2 units of run, y = 0 after 3.
        assert.deepEqual(getExpandCellOnPlane(ray, 0.8), { x: 2, z: 2 });
        assert.deepEqual(getExpandCellOnPlane(ray, 0), { x: 3, z: 3 });
    });

    it('returns null for a ray parallel to or pointing away from the plane', () => {
        const flat = new Ray(new Vector3(0, 1, 0), new Vector3(1, 0, 0));
        const away = new Ray(
            new Vector3(0, 1, 0),
            new Vector3(0, 1, 1).normalize(),
        );

        assert.equal(getExpandCellOnPlane(flat, 0), null);
        assert.equal(getExpandCellOnPlane(away, 0), null);
        assert.equal(getExpandCellOnPlane(flat, Number.NaN), null);
    });

    it('never returns negative zero', () => {
        const ray = new Ray(new Vector3(-0.3, 1, -0.2), new Vector3(0, -1, 0));
        const cell = getExpandCellOnPlane(ray, 0);
        assert.ok(cell);
        assert.ok(Object.is(cell.x, 0));
        assert.ok(Object.is(cell.z, 0));
    });
});

describe('getExpandPointerCell', () => {
    it('finds the cell under the pointer on the surface at the given height', () => {
        const camera = createGardenCamera(0, new Vector3(1, 0, -1));
        // The pointer is on the top of a 0.8-high copy at (2, -3): the plane at
        // that height finds the cell, the ground plane finds one further back.
        const pointer = projectToClient(camera, { x: 2, y: 0.8, z: -3 });

        assert.deepEqual(
            getExpandPointerCell({
                camera,
                clientX: pointer.x,
                clientY: pointer.y,
                planeHeight: 0.8,
                rect,
            }),
            { x: 2, z: -3 },
        );
        assert.notDeepEqual(
            getExpandPointerCell({
                camera,
                clientX: pointer.x,
                clientY: pointer.y,
                planeHeight: 0,
                rect,
            }),
            { x: 2, z: -3 },
        );
    });

    it('finds ground cells on the y = 0 plane from every world rotation', () => {
        for (const rotation of [0, 1, 2, 3]) {
            const camera = createGardenCamera(rotation, new Vector3(2, 0, 1));
            for (const cell of [
                { x: 0, z: 0 },
                { x: 4, z: -2 },
                { x: -3, z: 5 },
            ]) {
                const pointer = projectToClient(camera, {
                    x: cell.x + 0.2,
                    y: 0,
                    z: cell.z - 0.3,
                });
                assert.deepEqual(
                    getExpandPointerCell({
                        camera,
                        clientX: pointer.x,
                        clientY: pointer.y,
                        planeHeight: 0,
                        rect,
                    }),
                    cell,
                    `rotation ${rotation}, cell ${cell.x},${cell.z}`,
                );
            }
        }
    });

    it('returns null for an empty canvas rectangle or a non-finite pointer', () => {
        const camera = createGardenCamera(0);
        assert.equal(
            getExpandPointerCell({
                camera,
                clientX: 10,
                clientY: 10,
                planeHeight: 0,
                rect: { left: 0, top: 0, width: 0, height: 100 },
            }),
            null,
        );
        assert.equal(
            getExpandPointerCell({
                camera,
                clientX: Number.NaN,
                clientY: 10,
                planeHeight: 0,
                rect,
            }),
            null,
        );
    });
});

describe('getExpandArrowCellDelta', () => {
    const keys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'] as const;

    it('maps the arrows to grid steps for each world rotation', () => {
        const expected: Record<number, Record<string, ExpandCell>> = {
            0: {
                ArrowUp: { x: 0, z: 1 },
                ArrowRight: { x: -1, z: 0 },
                ArrowDown: { x: 0, z: -1 },
                ArrowLeft: { x: 1, z: 0 },
            },
            1: {
                ArrowUp: { x: 1, z: 0 },
                ArrowRight: { x: 0, z: 1 },
                ArrowDown: { x: -1, z: 0 },
                ArrowLeft: { x: 0, z: -1 },
            },
            2: {
                ArrowUp: { x: 0, z: -1 },
                ArrowRight: { x: 1, z: 0 },
                ArrowDown: { x: 0, z: 1 },
                ArrowLeft: { x: -1, z: 0 },
            },
            3: {
                ArrowUp: { x: -1, z: 0 },
                ArrowRight: { x: 0, z: -1 },
                ArrowDown: { x: 1, z: 0 },
                ArrowLeft: { x: 0, z: 1 },
            },
        };

        for (const rotation of [0, 1, 2, 3]) {
            for (const key of keys) {
                assert.deepEqual(
                    getExpandArrowCellDelta(key, rotation),
                    expected[rotation]?.[key],
                    `rotation ${rotation}, ${key}`,
                );
            }
        }
    });

    it('treats unwrapped world rotations like their quarter turn', () => {
        // The store counts Q/W presses without wrapping.
        for (const key of keys) {
            assert.deepEqual(
                getExpandArrowCellDelta(key, 5),
                getExpandArrowCellDelta(key, 1),
            );
            assert.deepEqual(
                getExpandArrowCellDelta(key, -1),
                getExpandArrowCellDelta(key, 3),
            );
            assert.deepEqual(
                getExpandArrowCellDelta(key, -6),
                getExpandArrowCellDelta(key, 2),
            );
        }
    });

    it('moves the corner the way the arrow points on screen', () => {
        // Client y grows downwards. Each arrow is turned 45° clockwise, so
        // ArrowUp lands up and to the right, ArrowRight down and to the right.
        const screenSigns: Record<
            (typeof keys)[number],
            readonly [x: number, y: number]
        > = {
            ArrowUp: [1, -1],
            ArrowRight: [1, 1],
            ArrowDown: [-1, 1],
            ArrowLeft: [-1, -1],
        };
        for (const rotation of [0, 1, 2, 3]) {
            const camera = createGardenCamera(rotation, new Vector3(1, 0, 1));
            const from = projectToClient(camera, { x: 1, y: 0, z: 1 });
            for (const key of keys) {
                const delta = getExpandArrowCellDelta(key, rotation);
                assert.ok(delta);
                const to = projectToClient(camera, {
                    x: 1 + delta.x,
                    y: 0,
                    z: 1 + delta.z,
                });
                const [signX, signY] = screenSigns[key];
                assert.equal(
                    Math.sign(to.x - from.x),
                    signX,
                    `rotation ${rotation}, ${key} x`,
                );
                assert.equal(
                    Math.sign(to.y - from.y),
                    signY,
                    `rotation ${rotation}, ${key} y`,
                );
            }
        }
    });

    it('ignores other keys', () => {
        assert.equal(getExpandArrowCellDelta('Enter', 0), null);
        assert.equal(getExpandArrowCellDelta('KeyQ', 0), null);
        assert.equal(getExpandArrowCellDelta('Escape', 2), null);
    });
});

describe('isExpandCornerBeyondCap', () => {
    const source = { x: 3, z: -2 };

    it('allows maxSide − 1 cells in every direction', () => {
        for (const maxSide of [10, 5]) {
            const reach = maxSide - 1;
            for (const [dx, dz] of [
                [reach, reach],
                [-reach, reach],
                [reach, -reach],
                [-reach, -reach],
            ] as const) {
                assert.equal(
                    isExpandCornerBeyondCap(
                        source,
                        { x: source.x + dx, z: source.z + dz },
                        maxSide,
                    ),
                    false,
                    `maxSide ${maxSide}, ${dx},${dz}`,
                );
            }
        }
    });

    it('flags one more cell on either axis in every quadrant', () => {
        for (const maxSide of [10, 5]) {
            const over = maxSide;
            for (const [dx, dz] of [
                [over, 0],
                [-over, 0],
                [0, over],
                [0, -over],
                [over, -over],
            ] as const) {
                assert.equal(
                    isExpandCornerBeyondCap(
                        source,
                        { x: source.x + dx, z: source.z + dz },
                        maxSide,
                    ),
                    true,
                    `maxSide ${maxSide}, ${dx},${dz}`,
                );
            }
        }
    });

    it('treats a broken cap as the source cell only', () => {
        assert.equal(
            isExpandCornerBeyondCap(source, source, Number.NaN),
            false,
        );
        assert.equal(
            isExpandCornerBeyondCap(source, { x: 4, z: -2 }, Number.NaN),
            true,
        );
    });
});

describe('isExpandAutopanArmed', () => {
    // A 360 px phone canvas: the 96 px edge bands cover over half its width.
    const phone = { left: 0, top: 0, width: 360, height: 740 };
    const at = (clientX: number, clientY: number) => ({ clientX, clientY });

    it('arms at once when the drag starts outside every edge band', () => {
        assert.equal(
            isExpandAutopanArmed({
                start: at(180, 370),
                pointer: at(20, 370),
                viewport: phone,
            }),
            true,
        );
        assert.equal(
            isExpandAutopanArmed({
                start: at(180, 370),
                pointer: at(180, 380),
                viewport: phone,
            }),
            true,
        );
    });

    it('stays off while a knob near the left edge is dragged along it', () => {
        // The phone debug-page case: the knob at x 38, dragged straight down.
        for (const pointer of [at(38, 450), at(40, 520), at(30, 600)]) {
            assert.equal(
                isExpandAutopanArmed({
                    start: at(38, 419),
                    pointer,
                    viewport: phone,
                }),
                false,
                `${pointer.clientX},${pointer.clientY}`,
            );
        }
    });

    it('arms when the pointer pushes further toward the edge it started near', () => {
        assert.equal(
            isExpandAutopanArmed({
                start: at(38, 419),
                pointer: at(38 - expandAutopanPushPx, 430),
                viewport: phone,
            }),
            true,
        );
        // Right and bottom bands push the other way.
        assert.equal(
            isExpandAutopanArmed({
                start: at(330, 370),
                pointer: at(330 + expandAutopanPushPx, 370),
                viewport: phone,
            }),
            true,
        );
        assert.equal(
            isExpandAutopanArmed({
                start: at(180, 700),
                pointer: at(180, 700 + expandAutopanPushPx),
                viewport: phone,
            }),
            true,
        );
        assert.equal(
            isExpandAutopanArmed({
                start: at(180, 700),
                pointer: at(180, 690),
                viewport: phone,
            }),
            false,
        );
    });

    it('arms once the pointer leaves every band the drag started in', () => {
        assert.equal(
            isExpandAutopanArmed({
                start: at(38, 419),
                pointer: at(120, 419),
                viewport: phone,
            }),
            true,
        );
        // Started in the bottom-left corner: leaving only the bottom band is
        // not enough, the left band still holds.
        assert.equal(
            isExpandAutopanArmed({
                start: at(30, 720),
                pointer: at(40, 500),
                viewport: phone,
            }),
            false,
        );
        assert.equal(
            isExpandAutopanArmed({
                start: at(30, 720),
                pointer: at(150, 500),
                viewport: phone,
            }),
            true,
        );
    });

    it('arms for an empty canvas, which never pans', () => {
        assert.equal(
            isExpandAutopanArmed({
                start: at(10, 10),
                pointer: at(10, 10),
                viewport: { left: 0, top: 0, width: 0, height: 0 },
            }),
            true,
        );
    });
});
