import assert from 'node:assert/strict';
import test from 'node:test';
import type { CatPathCell, CatPathSurface } from './catPathfinding';
import { findCatPath } from './catPathfinding';

function createSurfaces({
    maxX,
    maxZ,
    minX,
    minZ,
}: {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
}) {
    const surfaces: CatPathSurface[] = [];

    for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            surfaces.push({ x, y: 0.42, z });
        }
    }

    return surfaces;
}

test('keeps direct cat movement when no cells block the segment', () => {
    const path = findCatPath({
        blockedCells: [],
        from: { x: -2, y: 0.42, z: 0 },
        surfaces: createSurfaces({ minX: -2, maxX: 2, minZ: -1, maxZ: 1 }),
        to: { x: 2, y: 0.42, z: 0 },
    });

    assert.equal(path.status, 'direct');
    assert.equal(path.points.length, 2);
    assert.equal(path.visitedCellCount, 0);
});

test('routes cats through an early passage instead of through blocking entities', () => {
    const blockedCells: CatPathCell[] = [
        { x: -1, z: 0 },
        { x: 0, z: 0 },
        { x: 1, z: 0 },
    ];
    const path = findCatPath({
        blockedCells,
        from: { x: -2, y: 0.42, z: 0 },
        surfaces: createSurfaces({ minX: -2, maxX: 2, minZ: -1, maxZ: 1 }),
        to: { x: 2, y: 0.42, z: 0 },
    });

    assert.equal(path.status, 'path');
    assert.ok(path.visitedCellCount > 0);
    assert.ok(path.points.length > 2);
    assert.equal(
        path.points.some(
            (point) =>
                blockedCells.some(
                    (cell) =>
                        Math.round(point.x) === cell.x &&
                        Math.round(point.z) === cell.z,
                ) &&
                point.x !== -2 &&
                point.x !== 2,
        ),
        false,
    );
});

test('allows the cat to start or finish on an occupied target cell', () => {
    const path = findCatPath({
        blockedCells: [
            { x: -2, z: 0 },
            { x: 2, z: 0 },
            { x: 0, z: 0 },
        ],
        from: { x: -2, y: 0.42, z: 0 },
        surfaces: createSurfaces({ minX: -2, maxX: 2, minZ: -1, maxZ: 1 }),
        to: { x: 2, y: 0.42, z: 0 },
    });

    assert.equal(path.status, 'path');
    assert.deepEqual(path.startCell, { x: -2, z: 0 });
    assert.deepEqual(path.targetCell, { x: 2, z: 0 });
});

test('routes through implicit open terrain when listed surfaces are sparse', () => {
    const path = findCatPath({
        blockedCells: [
            { x: -1, z: -1 },
            { x: -1, z: 0 },
            { x: -1, z: 1 },
            { x: 0, z: -1 },
            { x: 0, z: 0 },
            { x: 0, z: 1 },
            { x: 1, z: -1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
        ],
        from: { x: -2, y: 0.42, z: 0 },
        surfaces: [
            { x: -2, y: 0.42, z: 0 },
            { x: 2, y: 0.42, z: 0 },
        ],
        to: { x: 2, y: 0.42, z: 0 },
    });

    assert.equal(path.status, 'path');
    assert.ok(path.points.length > 2);
    assert.ok(path.points.some((point) => Math.abs(point.z) >= 2));
});

test('reports an unreachable target without crossing its blocked enclosure', () => {
    const from = { x: -3, y: 0.42, z: 0 };
    const path = findCatPath({
        blockedCells: [
            { x: -1, z: -1 },
            { x: -1, z: 0 },
            { x: -1, z: 1 },
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: 1, z: -1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
        ],
        from,
        surfaces: [from, { x: 0, y: 0.42, z: 0 }],
        to: { x: 0, y: 0.42, z: 0 },
    });

    assert.equal(path.status, 'unreachable');
    assert.deepEqual(path.points, [from]);
    assert.equal(path.distance, 0);
});

test('optional walkable cells keep terrain-bound animals off missing ground', () => {
    const walkableCells = [
        { x: -2, z: 0 },
        { x: -1, z: 0 },
        { x: -1, z: 1 },
        { x: 0, z: 1 },
        { x: 1, z: 1 },
        { x: 2, z: 1 },
        { x: 2, z: 0 },
    ];
    const path = findCatPath({
        blockedCells: [{ x: 0, z: 0 }],
        from: { x: -2, y: 0.42, z: 0 },
        surfaces: walkableCells.map((cell) => ({ ...cell, y: 0.42 })),
        to: { x: 2, y: 0.42, z: 0 },
        walkableCells,
    });

    assert.equal(path.status, 'path');
    assert.ok(path.points.some((point) => point.z === 1));
    assert.equal(
        path.points.some((point) => point.z < 0),
        false,
    );
});

test('optional walkable cells reject a route across disconnected terrain', () => {
    const from = { x: -2, y: 0.42, z: 0 };
    const to = { x: 2, y: 0.42, z: 0 };
    const path = findCatPath({
        blockedCells: [{ x: 0, z: 0 }],
        from,
        surfaces: [from, { x: -1, y: 0.42, z: 0 }, to],
        to,
        walkableCells: [from, { x: -1, z: 0 }, to],
    });

    assert.equal(path.status, 'unreachable');
    assert.deepEqual(path.points, [from]);
});
