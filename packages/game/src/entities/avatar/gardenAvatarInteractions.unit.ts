import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Ray, Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { Stack } from '../../types/Stack';
import {
    findGardenAvatarCactusContact,
    getGardenAvatarBlockInteractionTargets,
    getGardenAvatarCactusBounceDirection,
    getGardenAvatarForwardDirection,
    getGardenAvatarSeatPose,
    resolveAimedGardenAvatarAnimal,
    resolveAimedGardenAvatarBlock,
} from './gardenAvatarInteractions';

function stack(
    x: number,
    z: number,
    name: string,
    id = name,
    rotation = 0,
): Stack {
    return {
        blocks: [{ id, name, rotation }],
        position: new Vector3(x, 0, z),
    };
}

describe('garden avatar world interactions', () => {
    it('resolves a centered, nearby seat and ignores blocks beyond reach', () => {
        const nearTargets = getGardenAvatarBlockInteractionTargets({
            blockData: getLocalSandboxBlockData(),
            stacks: [stack(0, -2, 'BeachChair', 'chair')],
        });
        const farTargets = getGardenAvatarBlockInteractionTargets({
            blockData: getLocalSandboxBlockData(),
            stacks: [stack(0, -5, 'BeachChair', 'far-chair')],
        });
        const ray = new Ray(new Vector3(0, 0.3, 0), new Vector3(0, 0, -1));

        assert.equal(
            resolveAimedGardenAvatarBlock({
                actorPosition: new Vector3(0, 0, 0),
                ray,
                targets: nearTargets,
            })?.block.id,
            'chair',
        );
        assert.equal(
            resolveAimedGardenAvatarBlock({
                actorPosition: new Vector3(0, 0, 0),
                ray,
                targets: farTargets,
            }),
            null,
        );
    });

    it('keeps external Outlet targets available to avatar aiming', () => {
        const interactiveBlockIds = new Set(['outlet-plant']);
        const targets = getGardenAvatarBlockInteractionTargets({
            blockData: getLocalSandboxBlockData(),
            interactiveBlockIds,
            stacks: [
                stack(0, -1, 'Block_Grass', 'outlet-plant'),
                stack(1, -1, 'Block_Grass', 'background'),
            ],
        });

        assert.deepEqual(
            targets.map((target) => target.block.id),
            ['outlet-plant'],
        );
    });

    it('derives stable chair and bench seating poses from block rotation', () => {
        const targets = getGardenAvatarBlockInteractionTargets({
            blockData: getLocalSandboxBlockData(),
            stacks: [
                stack(3, 4, 'BeachChair', 'chair', 1),
                stack(-2, 1, 'WoodenBench', 'bench', 2),
            ],
        });

        const chairPose = targets[0]
            ? getGardenAvatarSeatPose(targets[0])
            : null;
        const benchPose = targets[1]
            ? getGardenAvatarSeatPose(targets[1])
            : null;
        assert.ok(chairPose);
        assert.ok(benchPose);
        assert.equal(chairPose.yaw, Math.PI / 2);
        assert.equal(chairPose.y, 0.3);
        assert.ok(Math.hypot(chairPose.exitX - 3, chairPose.exitZ - 4) > 0.4);
        assert.equal(benchPose.yaw, Math.PI);
        assert.equal(benchPose.y, 0.29);
        assert.ok(Math.hypot(benchPose.exitX + 2, benchPose.exitZ - 1) > 0.4);
    });

    it('selects only a fresh, close cat or dog on the center ray', () => {
        const ray = new Ray(new Vector3(0, 0.3, 0), new Vector3(0, 0, -1));
        const aimed = resolveAimedGardenAvatarAnimal({
            actorPosition: new Vector3(0, 0, 0),
            entries: [
                {
                    behavior: 'roam',
                    id: 'cat-a',
                    position: { x: 0, y: 0, z: -1.5 },
                    species: 'Cat',
                    updatedAt: 10,
                },
                {
                    behavior: 'roam',
                    id: 'dog-stale',
                    position: { x: 0, y: 0, z: -1 },
                    species: 'Dog',
                    updatedAt: 4,
                },
            ],
            now: 10.2,
            ray,
        });

        assert.equal(aimed?.id, 'cat-a');
    });

    it('detects cactus contact and bounces away from its spikes', () => {
        const targets = getGardenAvatarBlockInteractionTargets({
            blockData: getLocalSandboxBlockData(),
            stacks: [stack(0, 0, 'CactusBarrel', 'cactus')],
        });
        const cactus = findGardenAvatarCactusContact({
            position: { x: 0.55, z: 0 },
            targets,
        });
        assert.ok(cactus);
        assert.deepEqual(
            getGardenAvatarCactusBounceDirection({
                attemptedDirection: { x: -1, z: 0 },
                cactus,
                position: { x: 0.55, z: 0 },
            }),
            { x: 1, z: 0 },
        );
    });

    it('kicks in the avatar model forward direction', () => {
        assert.deepEqual(getGardenAvatarForwardDirection(0), { x: -0, z: -1 });
        const quarterTurn = getGardenAvatarForwardDirection(Math.PI / 2);
        assert.ok(Math.abs(quarterTurn.x + 1) < 0.000_001);
        assert.ok(Math.abs(quarterTurn.z) < 0.000_001);
    });
});
