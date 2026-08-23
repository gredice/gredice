import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createGardenAvatarCollisionWorld,
    findGardenAvatarSpawnPoint,
    resolveGardenAvatarHorizontalMovement,
} from '../entities/avatar/gardenAvatarMovement';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import {
    buildOutletGardenStacks,
    outletGardenVisitorSpawnPoint,
    reconcileOutletGardenSlots,
} from './outletGardenLayout';
import { normalizePublicGardenStacks } from './PublicGardenViewer';

test('the Outlet visitor spawns on the mulch aisle and can walk through its first turn', () => {
    const offers = [
        {
            id: 1,
            plantId: 1,
            plantSortId: 10,
            remainingQuantity: 20,
        },
    ];
    const assignments = reconcileOutletGardenSlots(new Map(), offers);
    const publicStacks = buildOutletGardenStacks(offers, assignments);
    const stacks = normalizePublicGardenStacks(publicStacks);
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks,
    });
    const spawn = findGardenAvatarSpawnPoint(
        world,
        outletGardenVisitorSpawnPoint,
    );

    assert.ok(spawn);
    assert.deepEqual({ x: spawn.x, z: spawn.z }, outletGardenVisitorSpawnPoint);
    assert.equal(
        publicStacks
            .find((stack) => stack.x === spawn.x && stack.y === spawn.z)
            ?.blocks.some((block) => block.name === 'MulchWood'),
        true,
    );
    assert.ok(
        publicStacks.some((stack) =>
            stack.blocks.some((block) => block.name.startsWith('Pot')),
        ),
    );

    const firstLeg = resolveGardenAvatarHorizontalMovement({
        deltaX: 0,
        deltaZ: 10 - spawn.z,
        position: spawn,
        world,
    });
    const afterTurn = resolveGardenAvatarHorizontalMovement({
        deltaX: 4,
        deltaZ: 0,
        position: firstLeg.position,
        world,
    });

    assert.equal(firstLeg.collided, false);
    assert.ok(Math.abs(firstLeg.position.x) < 0.000_001);
    assert.ok(Math.abs(firstLeg.position.z - 10) < 0.000_001);
    assert.equal(afterTurn.collided, false);
    assert.ok(Math.abs(afterTurn.position.x - 4) < 0.000_001);
    assert.ok(Math.abs(afterTurn.position.z - 10) < 0.000_001);

    const lightColliders = world.surfaces.filter(
        (surface) => surface.debugLabel === 'DoubleGardenLightPole',
    );
    assert.ok(lightColliders.length >= 2);
    assert.ok(
        lightColliders.every(
            (surface) =>
                (surface.halfWidth ?? 0) > 0 &&
                (surface.halfWidth ?? 1) < 0.5 &&
                (surface.halfDepth ?? 0) > 0 &&
                (surface.halfDepth ?? 1) < 0.5,
        ),
    );
});
