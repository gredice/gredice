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

test('falls back to direct movement when no walkable passage exists', () => {
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
        surfaces: createSurfaces({ minX: -2, maxX: 2, minZ: -1, maxZ: 1 }),
        to: { x: 2, y: 0.42, z: 0 },
    });

    assert.equal(path.status, 'fallback');
    assert.equal(path.points.length, 2);
});
