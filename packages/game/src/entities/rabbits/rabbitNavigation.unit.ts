import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnimalMovementSurface } from '../animals/animalMovementTerrain';
import { findRabbitFleePath, findRabbitPath } from './rabbitNavigation';

function groundGrid({
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
    const surfaces: AnimalMovementSurface[] = [];
    for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            surfaces.push({ kind: 'ground', x, y: 0.02, z });
        }
    }
    return surfaces;
}

test('rabbit routes its hops around blockers', () => {
    const path = findRabbitPath({
        blockedCells: [
            { x: -1, z: 0 },
            { x: 0, z: 0 },
            { x: 1, z: 0 },
        ],
        from: { x: -2, y: 0.02, z: 0 },
        groundSurfaces: groundGrid({
            minX: -2,
            maxX: 2,
            minZ: -1,
            maxZ: 1,
        }),
        to: { x: 2, y: 0.02, z: 0 },
    });

    assert.equal(path.status, 'path');
    assert.ok(path.points.some((point) => Math.abs(point.z) === 1));
});

test('rabbit never crosses or settles in missing terrain', () => {
    const from = { x: -2, y: 0.02, z: 0 };
    const to = { x: 2, y: 0.02, z: 0 };
    const path = findRabbitPath({
        blockedCells: [],
        from,
        groundSurfaces: [
            { kind: 'ground', ...from },
            { kind: 'ground', ...to },
        ],
        to,
    });

    assert.equal(path.status, 'unreachable');
    assert.deepEqual(path.points, [from]);
});

test('rabbit never settles on a blocking entity', () => {
    const path = findRabbitPath({
        blockedCells: [{ x: 1, z: 0 }],
        from: { x: 0, y: 0.02, z: 0 },
        groundSurfaces: groundGrid({
            minX: 0,
            maxX: 1,
            minZ: 0,
            maxZ: 0,
        }),
        to: { x: 1, y: 0.02, z: 0 },
    });

    assert.equal(path.status, 'unreachable');
});

test('flee path increases avatar distance while respecting an obstacle wall', () => {
    const surfaces = groundGrid({ minX: -2, maxX: 3, minZ: -2, maxZ: 2 });
    const path = findRabbitFleePath({
        avatar: { x: -1, z: 0 },
        blockedCells: [
            { x: 1, z: -1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
        ],
        candidates: [
            { x: 3, y: 0.02, z: 0 },
            { x: 0, y: 0.02, z: 2 },
        ],
        from: { x: 0, y: 0.02, z: 0 },
        groundSurfaces: surfaces,
        home: { x: 0, z: 0 },
        homeRange: 5.5,
    });

    assert.ok(path);
    assert.notEqual(path.status, 'unreachable');
    assert.ok(path.points.some((point) => Math.abs(point.z) >= 2));
});
