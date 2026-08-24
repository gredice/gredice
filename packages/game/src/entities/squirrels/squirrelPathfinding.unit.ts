import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AnimalMovementSurface } from '../animals/animalMovementTerrain';
import { findSquirrelPath } from './squirrelPathfinding';

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
            surfaces.push({ kind: 'ground', x, y: 0.42, z });
        }
    }
    return surfaces;
}

describe('squirrel ground pathfinding', () => {
    it('routes around blockers without using implicit terrain', () => {
        const blockedCells = [
            { x: -1, z: 0 },
            { x: 0, z: 0 },
            { x: 1, z: 0 },
        ];
        const path = findSquirrelPath({
            blockedCells,
            from: { x: -2, y: 0.42, z: 0 },
            surfaces: groundGrid({ minX: -2, maxX: 2, minZ: -1, maxZ: 1 }),
            to: { x: 2, y: 0.42, z: 0 },
        });

        assert.equal(path.status, 'path');
        assert.ok(path.points.some((point) => Math.abs(point.z) >= 1));
        assert.equal(
            path.points.some((point) =>
                blockedCells.some(
                    (cell) =>
                        Math.round(point.x) === cell.x &&
                        Math.round(point.z) === cell.z,
                ),
            ),
            false,
        );
    });

    it('rejects water and missing cells instead of routing through them', () => {
        const from = { x: -1, y: 0.42, z: 0 };
        const to = { x: 1, y: 0.42, z: 0 };
        for (const middleSurface of [
            undefined,
            {
                kind: 'water',
                x: 0,
                y: 0.2,
                z: 0,
            } satisfies AnimalMovementSurface,
        ]) {
            const path = findSquirrelPath({
                blockedCells: [],
                from,
                surfaces: [
                    { kind: 'ground', ...from },
                    ...(middleSurface ? [middleSurface] : []),
                    { kind: 'ground', ...to },
                ],
                to,
            });

            assert.equal(path.status, 'unreachable');
            assert.deepEqual(path.points, [from]);
        }
    });

    it('routes around an excessive terrain-height jump', () => {
        const surfaces = groundGrid({
            minX: -1,
            maxX: 1,
            minZ: -1,
            maxZ: 1,
        }).map((surface) =>
            surface.x === 0 && surface.z === 0 ? { ...surface, y: 5 } : surface,
        );
        const path = findSquirrelPath({
            blockedCells: [],
            from: { x: -1, y: 0.42, z: 0 },
            surfaces,
            to: { x: 1, y: 0.42, z: 0 },
        });

        assert.equal(path.status, 'path');
        assert.ok(path.points.some((point) => Math.abs(point.z) >= 1));
    });

    it('retains continuous authored slopes as traversable terrain', () => {
        const surfaces: AnimalMovementSurface[] = [
            { kind: 'ground', x: -1, y: 0.02, z: 0 },
            {
                bottomY: 0.02,
                kind: 'ground',
                slopeBlockName: 'Block_Grass_Angle',
                x: 0,
                y: 0.42,
                z: 0,
            },
            { kind: 'ground', x: 1, y: 0.42, z: 0 },
        ];
        const path = findSquirrelPath({
            blockedCells: [],
            from: { x: -1, y: 0.02, z: 0 },
            surfaces,
            to: { x: 1, y: 0.42, z: 0 },
        });

        assert.equal(path.status, 'direct');
    });

    it('does not settle inside a fully blocked enclosure', () => {
        const from = { x: -2, y: 0.42, z: 0 };
        const path = findSquirrelPath({
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
            surfaces: groundGrid({ minX: -2, maxX: 1, minZ: -1, maxZ: 1 }),
            to: { x: 0, y: 0.42, z: 0 },
        });

        assert.equal(path.status, 'unreachable');
    });
});
