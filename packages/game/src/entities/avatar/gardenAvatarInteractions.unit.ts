import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Object3D, Ray, Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { Stack } from '../../types/Stack';
import {
    findGardenAvatarCactusContact,
    findGardenAvatarSeatExit,
    gardenAvatarAnimalAimProfiles,
    getGardenAvatarBlockInteractionTargets,
    getGardenAvatarCactusBounceDirection,
    getGardenAvatarForwardDirection,
    getGardenAvatarPointerLockIntent,
    getGardenAvatarSeatPose,
    isGardenAvatarInteractionOccluded,
    isPettableAnimalSpecies,
    normalizeGardenAvatarInteractionResult,
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
            })?.target.block.id,
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
        assert.equal(chairPose.yaw, (3 * Math.PI) / 2);
        assert.equal(chairPose.y, 0.3);
        assert.ok(Math.hypot(chairPose.exitX - 3, chairPose.exitZ - 4) > 0.4);
        assert.equal(benchPose.yaw, 0);
        assert.equal(benchPose.y, 0.29);
        assert.ok(Math.hypot(benchPose.exitX + 2, benchPose.exitZ - 1) > 0.4);
    });

    it('seats the avatar looking out of the seat instead of into its back', () => {
        const targets = getGardenAvatarBlockInteractionTargets({
            blockData: getLocalSandboxBlockData(),
            stacks: [
                stack(0, 0, 'BeachChair', 'chair-north'),
                stack(4, 0, 'BeachChair', 'chair-east', 1),
            ],
        });

        // Seat models put the backrest at -Z, so an unrotated chair seats the
        // avatar looking towards +Z and stepping out on the same side.
        const northPose = targets[0]
            ? getGardenAvatarSeatPose(targets[0])
            : null;
        assert.ok(northPose);
        const northFacing = getGardenAvatarForwardDirection(northPose.yaw);
        assert.ok(Math.abs(northFacing.x) < 0.000_001);
        assert.ok(Math.abs(northFacing.z - 1) < 0.000_001);
        assert.ok(northPose.exitZ > 0.4);

        const eastPose = targets[1]
            ? getGardenAvatarSeatPose(targets[1])
            : null;
        assert.ok(eastPose);
        const eastFacing = getGardenAvatarForwardDirection(eastPose.yaw);
        assert.ok(Math.abs(eastFacing.x - 1) < 0.000_001);
        assert.ok(Math.abs(eastFacing.z) < 0.000_001);
        assert.ok(eastPose.exitX > 4.4);
    });

    it('uses an alternate seat exit and stays seated when every exit is blocked', () => {
        const [target] = getGardenAvatarBlockInteractionTargets({
            blockData: getLocalSandboxBlockData(),
            stacks: [stack(3, 4, 'BeachChair', 'chair', 1)],
        });
        const pose = target ? getGardenAvatarSeatPose(target) : null;
        assert.ok(pose);
        const preferredExit = pose.exitCandidates[0];
        const alternateExit = pose.exitCandidates[1];
        assert.ok(preferredExit);
        assert.ok(alternateExit);

        assert.deepEqual(
            findGardenAvatarSeatExit({
                pose,
                world: {
                    blockedCells: [preferredExit],
                    surfaces: [],
                },
            }),
            { ...alternateExit, y: 0 },
        );
        assert.equal(
            findGardenAvatarSeatExit({
                pose,
                world: {
                    blockedCells: pose.exitCandidates,
                    surfaces: [],
                },
            }),
            null,
        );
    });

    it('rejects an aimed block hidden by closer scene geometry', () => {
        const targets = getGardenAvatarBlockInteractionTargets({
            blockData: getLocalSandboxBlockData(),
            stacks: [stack(0, -2, 'WoodenSign', 'sign')],
        });
        const ray = new Ray(new Vector3(0, 0.3, 0), new Vector3(0, 0, -1));
        const resolved = resolveAimedGardenAvatarBlock({
            actorPosition: new Vector3(0, 0, 0),
            ray,
            targets,
        });
        assert.ok(resolved);

        assert.equal(
            isGardenAvatarInteractionOccluded({
                intersections: [
                    {
                        distance: 0.75,
                        object: new Object3D(),
                    },
                ],
                layerObject: new Object3D(),
                ray,
                resolvedHitPoint: resolved.hitPoint,
            }),
            true,
        );
    });

    it('selects every fresh, nearby pettable animal on the center ray', () => {
        const ray = new Ray(new Vector3(0, 0.3, 0), new Vector3(0, 0, -1));
        for (const species of [
            'Cat',
            'Chicken',
            'Cow',
            'Dog',
            'Goat',
            'Piglet',
        ] as const) {
            assert.equal(isPettableAnimalSpecies(species), true);
            const aimed = resolveAimedGardenAvatarAnimal({
                actorPosition: new Vector3(0, 0, 0),
                entries: [
                    {
                        behavior: 'roam',
                        id: `${species.toLowerCase()}-a`,
                        position: { x: 0, y: 0, z: -1.5 },
                        species,
                        updatedAt: 10,
                    },
                ],
                now: 10.2,
                ray,
            });

            assert.equal(aimed?.entry.species, species);
        }
    });

    it('uses species-sized aim profiles and rejects ineligible animals', () => {
        const ray = new Ray(new Vector3(0, 0.3, 0), new Vector3(0, 0, -1));
        const actorPosition = new Vector3(0, 0, 0);
        const position = { x: 0.34, y: 0, z: -1.5 };

        assert.ok(
            gardenAvatarAnimalAimProfiles.Chicken.hitRadius <
                gardenAvatarAnimalAimProfiles.Piglet.hitRadius,
        );
        assert.ok(
            gardenAvatarAnimalAimProfiles.Piglet.hitRadius <
                gardenAvatarAnimalAimProfiles.Cow.hitRadius,
        );
        assert.equal(
            resolveAimedGardenAvatarAnimal({
                actorPosition,
                entries: [
                    {
                        behavior: 'forage',
                        id: 'chicken-offset',
                        position,
                        species: 'Chicken',
                        updatedAt: 10,
                    },
                ],
                now: 10.2,
                ray,
            }),
            null,
        );
        assert.equal(
            resolveAimedGardenAvatarAnimal({
                actorPosition,
                entries: [
                    {
                        behavior: 'wallow',
                        id: 'piglet-offset',
                        position,
                        species: 'Piglet',
                        updatedAt: 10,
                    },
                ],
                now: 10.2,
                ray,
            })?.entry.id,
            'piglet-offset',
        );
        assert.equal(isPettableAnimalSpecies('Bird'), false);
        assert.equal(
            resolveAimedGardenAvatarAnimal({
                actorPosition,
                entries: [
                    {
                        behavior: 'ground-peck',
                        id: 'bird-a',
                        position: { x: 0, y: 0, z: -1 },
                        species: 'Bird',
                        updatedAt: 10,
                    },
                    {
                        behavior: 'roam',
                        id: 'dog-stale',
                        position: { x: 0, y: 0, z: -1 },
                        species: 'Dog',
                        updatedAt: 4,
                    },
                    {
                        behavior: 'roam',
                        id: 'cat-far',
                        position: { x: 0, y: 0, z: -3 },
                        species: 'Cat',
                        updatedAt: 10,
                    },
                ],
                now: 10.2,
                ray,
            }),
            null,
        );
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

    it('reads legacy boolean interaction results', () => {
        assert.equal(normalizeGardenAvatarInteractionResult(true), 'handled');
        assert.equal(normalizeGardenAvatarInteractionResult(false), 'ignored');
        assert.equal(
            normalizeGardenAvatarInteractionResult(undefined),
            'ignored',
        );
        assert.equal(
            normalizeGardenAvatarInteractionResult('opened-ui'),
            'opened-ui',
        );
    });

    it('keeps pointer lock through world interactions and releases it for modals', () => {
        for (const result of ['handled', 'ignored'] as const) {
            assert.equal(
                getGardenAvatarPointerLockIntent({ locked: true, result }),
                'keep',
            );
            assert.equal(
                getGardenAvatarPointerLockIntent({ locked: false, result }),
                'lock',
            );
        }

        assert.equal(
            getGardenAvatarPointerLockIntent({
                locked: true,
                result: 'opened-ui',
            }),
            'unlock',
        );
        assert.equal(
            getGardenAvatarPointerLockIntent({
                locked: false,
                result: 'opened-ui',
            }),
            'keep',
        );
    });

    it('kicks in the avatar model forward direction', () => {
        assert.deepEqual(getGardenAvatarForwardDirection(0), { x: -0, z: -1 });
        const quarterTurn = getGardenAvatarForwardDirection(Math.PI / 2);
        assert.ok(Math.abs(quarterTurn.x + 1) < 0.000_001);
        assert.ok(Math.abs(quarterTurn.z) < 0.000_001);
    });
});
