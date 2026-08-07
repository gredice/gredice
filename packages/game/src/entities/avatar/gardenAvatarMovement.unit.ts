import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnimalMovementSurface } from '../animals/animalMovementTerrain';
import {
    findGardenAvatarRoute,
    findGardenAvatarSpawnPoint,
    type GardenAvatarCollisionWorld,
    getGardenAvatarGroundY,
    resolveGardenAvatarHorizontalMovement,
} from './gardenAvatarMovement';

function ground(x: number, z: number, y = 0): AnimalMovementSurface {
    return { kind: 'ground', x, y, z };
}

function grid({
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
            surfaces.push(ground(x, z));
        }
    }
    return surfaces;
}

test('stops the avatar radius before occupied garden cells', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [{ x: 1, z: 0 }],
        surfaces: grid({ minX: -1, maxX: 2, minZ: -1, maxZ: 1 }),
    };
    const result = resolveGardenAvatarHorizontalMovement({
        deltaX: 2,
        deltaZ: 0,
        position: { x: 0, y: 0, z: 0 },
        world,
    });

    assert.equal(result.collided, true);
    assert.ok(result.position.x <= 0.28);
});

test('slides along obstacles instead of cancelling all movement', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [{ x: 1, z: 0 }],
        surfaces: grid({ minX: -1, maxX: 2, minZ: -2, maxZ: 2 }),
    };
    const result = resolveGardenAvatarHorizontalMovement({
        deltaX: 1,
        deltaZ: 1,
        position: { x: 0, y: 0, z: 0 },
        world,
    });

    assert.equal(result.collided, true);
    assert.ok(result.position.x > 0);
    assert.ok(result.position.z > 0.8);
});

test('keeps the full collider on walkable ground', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [ground(0, 0)],
    };
    const result = resolveGardenAvatarHorizontalMovement({
        deltaX: 1,
        deltaZ: 0,
        position: { x: 0, y: 0, z: 0 },
        world,
    });

    assert.equal(result.collided, true);
    assert.ok(result.position.x <= 0.27);
});

test('accepts ordinary terrain steps and rejects tall ledges', () => {
    const stepWorld: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [ground(0, 0), ground(1, 0, 0.3)],
    };
    const ledgeWorld: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [ground(0, 0), ground(1, 0, 0.8)],
    };

    assert.equal(
        getGardenAvatarGroundY({
            currentGroundY: 0,
            position: { x: 0.55, z: 0 },
            world: stepWorld,
        }),
        0.3,
    );
    assert.equal(
        getGardenAvatarGroundY({
            currentGroundY: 0,
            position: { x: 0.55, z: 0 },
            world: ledgeWorld,
        }),
        null,
    );
});

test('routes roaming around blockers without cutting diagonal corners', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [{ x: 1, z: 0 }],
        surfaces: grid({ minX: 0, maxX: 2, minZ: -1, maxZ: 1 }),
    };
    const route = findGardenAvatarRoute({
        from: { x: 0, y: 0, z: 0 },
        to: { x: 2, y: 0, z: 0 },
        world,
    });

    assert.ok(route.length >= 5);
    assert.equal(
        route.some((point) => point.x === 1 && point.z === 0),
        false,
    );
});

test('selects a collision-safe spawn near the garden center', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [{ x: 1, z: 0 }],
        surfaces: [ground(0, 0), ground(1, 0), ground(2, 0)],
    };

    assert.deepEqual(findGardenAvatarSpawnPoint(world), { x: 0, y: 0, z: 0 });
});
