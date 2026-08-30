import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { Stack } from '../../types/Stack';
import { createAllAnimalDebugStacks } from '../animals/allAnimalDebugStacks';
import {
    type CowHabitat,
    type CowTarget,
    cowPathStaysOnValidTerrain,
    createCowHabitat,
    getCowPlacementCenter,
    resolveCowRuntimeForTarget,
} from './cowNavigation';

function stack(x: number, z: number, names: string[]): Stack {
    return {
        blocks: names.map((name, index) => ({
            id: `${name}:${x}:${z}:${index.toString()}`,
            name,
            rotation: 0,
        })),
        position: new Vector3(x, 0, z),
    };
}

function flatHabitat(): CowHabitat {
    return {
        blockedCells: [],
        groundSurfaces: [
            { kind: 'ground', x: 0, y: 0, z: 0 },
            { kind: 'ground', x: 1, y: 0, z: 0 },
            { kind: 'ground', x: 2, y: 0, z: 0 },
        ],
        home: {
            behavior: 'idle',
            id: 'home',
            position: new Vector3(0, 0, 0),
        },
        id: 'cow:a',
        roamAnchors: [],
        seed: 1,
    };
}

describe('cow navigation', () => {
    it('centers the two-cell Cow footprint across each rotation', () => {
        assert.deepEqual(getCowPlacementCenter({ rotation: 0, x: 2, z: 3 }), {
            x: 2,
            z: 3.5,
        });
        assert.deepEqual(getCowPlacementCenter({ rotation: 1, x: 2, z: 3 }), {
            x: 2.5,
            z: 3,
        });
    });

    it('keeps water and missing terrain out of cow paths', () => {
        const surfaces = [
            { kind: 'ground' as const, x: 0, y: 0, z: 0 },
            { kind: 'water' as const, x: 1, y: 0, z: 0 },
            { kind: 'ground' as const, x: 2, y: 0, z: 0 },
        ];
        assert.equal(
            cowPathStaysOnValidTerrain(
                [new Vector3(0, 0, 0), new Vector3(2, 0, 0)],
                surfaces,
            ),
            false,
        );
        assert.equal(
            cowPathStaysOnValidTerrain(
                [new Vector3(0, 0, 0), new Vector3(0.4, 0, 0)],
                surfaces,
            ),
            true,
        );
    });

    it('settles safely instead of falling back through an unreachable blocker', () => {
        const habitat = flatHabitat();
        habitat.blockedCells = [
            { x: 1, z: -1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
        ];
        const target = {
            behavior: 'roam',
            id: 'blocked-target',
            position: new Vector3(2, 0, 0),
        } satisfies CowTarget;
        const runtime = resolveCowRuntimeForTarget({
            from: new Vector3(0, 0, 0),
            habitat,
            now: 5,
            random: () => 0,
            target,
        });

        assert.equal(runtime.phase, 'settled');
        assert.equal(runtime.target.behavior, 'idle');
        assert.deepEqual(runtime.target.position.toArray(), [0, 0, 0]);
    });

    it('creates a valid home while treating other Cow anchors as blockers', () => {
        const stacks = [
            stack(0, 0, ['Block_Grass', 'Cow']),
            stack(3, 0, ['Block_Grass', 'Cow']),
            stack(1, 0, ['Block_Grass']),
            stack(2, 0, ['Block_Grass']),
        ];
        const homeStack = stacks[0];
        assert.ok(homeStack);
        const homeBlock = homeStack.blocks[1];
        assert.ok(homeBlock);
        const habitat = createCowHabitat({
            block: homeBlock,
            blockData: undefined,
            stack: homeStack,
            stacks,
        });

        assert.deepEqual(habitat.home.position.toArray(), [0, 0.025, 0.5]);
        assert.equal(
            habitat.blockedCells.some((cell) => cell.x === 0 && cell.z === 0),
            false,
        );
        assert.equal(
            habitat.blockedCells.some((cell) => cell.x === 0 && cell.z === 1),
            false,
        );
        assert.equal(
            habitat.blockedCells.some((cell) => cell.x === 3 && cell.z === 0),
            true,
        );
    });

    it('starts a shelter cow at the doorway while blocking the whole two-by-two home', () => {
        const homeStack = stack(0, 0, ['Block_Grass', 'CowShelter']);
        const homeBlock = homeStack.blocks[1];
        assert.ok(homeBlock);
        const grassInFront = [
            stack(1, 0, ['Block_Grass']),
            stack(0, -1, ['Block_Grass']),
            stack(1, -1, ['Block_Grass']),
            stack(1, -2, ['Block_Grass']),
        ];
        const habitat = createCowHabitat({
            block: homeBlock,
            blockData: getLocalSandboxBlockData(),
            stack: homeStack,
            stacks: [homeStack, ...grassInFront],
        });

        assert.deepEqual(
            habitat.home.position
                .toArray()
                .map((coordinate) => Math.round(coordinate * 1_000) / 1_000),
            [0.5, 0.425, -0.25],
        );
        assert.equal(habitat.home.facingYaw, Math.PI);
        for (const cell of [
            { x: 0, z: 0 },
            { x: 0, z: 1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
        ]) {
            assert.equal(
                habitat.blockedCells.some(
                    (blocked) => blocked.x === cell.x && blocked.z === cell.z,
                ),
                true,
            );
        }

        const runtime = resolveCowRuntimeForTarget({
            from: habitat.home.position,
            habitat,
            now: 0,
            random: () => 0,
            target: {
                behavior: 'roam',
                id: 'outside-shelter',
                position: new Vector3(1, 0.425, -2),
            },
        });
        assert.equal(runtime.phase, 'moving');
    });

    it('keeps every fauna profile cow target reachable for a moving trot', () => {
        const stacks: Stack[] = createAllAnimalDebugStacks().map(
            ({ blocks, position }) => ({
                blocks,
                position: new Vector3(position.x, position.y, position.z),
            }),
        );
        const cowHomes = stacks.flatMap((candidateStack) => {
            const block = candidateStack.blocks.find(
                (candidate) => candidate.name === 'CowShelter',
            );
            return block ? [{ block, stack: candidateStack }] : [];
        });
        const probeAngles = Array.from(
            { length: 8 },
            (_, index) => index * (Math.PI / 4),
        );

        assert.equal(cowHomes.length, 2);
        for (const { block, stack: homeStack } of cowHomes) {
            const habitat = createCowHabitat({
                block,
                blockData: getLocalSandboxBlockData(),
                stack: homeStack,
                stacks,
            });

            assert.ok(habitat.roamAnchors.length > 0);
            for (const anchor of habitat.roamAnchors) {
                for (const radius of [0.08, 0.26]) {
                    for (const angle of probeAngles) {
                        const runtime = resolveCowRuntimeForTarget({
                            from: habitat.home.position,
                            habitat,
                            now: 0,
                            random: () => 0,
                            target: {
                                behavior: 'trot',
                                id: `profile-trot-${anchor.id}`,
                                position: new Vector3(
                                    anchor.position.x +
                                        Math.cos(angle) * radius,
                                    anchor.position.y,
                                    anchor.position.z +
                                        Math.sin(angle) * radius,
                                ),
                            },
                        });

                        assert.equal(runtime.phase, 'moving');
                        assert.equal(runtime.target.behavior, 'trot');
                    }
                }
            }
        }
    });
});
