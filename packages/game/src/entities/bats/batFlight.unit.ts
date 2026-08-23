import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { Stack } from '../../types/Stack';
import {
    type BatFlightWorld,
    type BatHabitat,
    batMaxPathCandidateAttempts,
    chooseBatWaypoint,
    createBatAvoidanceWaypoint,
    createBatHabitats,
    isBatPointClear,
    isBatSegmentClear,
} from './batFlight';

function createWorld(): BatFlightWorld {
    return {
        bounds: { maxX: 6, maxZ: 5, minX: -6, minZ: -5 },
        obstacles: [
            {
                bottomY: 0,
                halfDepth: 0.65,
                halfWidth: 1.2,
                kind: 'ground',
                roamable: false,
                rotation: Math.PI / 4,
                x: 0,
                y: 3.2,
                z: 0,
            },
        ],
    };
}

function createHabitat(world = createWorld()): BatHabitat {
    return {
        center: new Vector3(0, 2.8, 0),
        id: 'environment-bat:test',
        roost: new Vector3(-4, 3.7, -3),
        seed: 17,
        waypoints: [
            {
                id: 'blocked-a',
                kind: 'circle',
                position: new Vector3(4, 2.4, 3),
            },
            {
                id: 'clear-b',
                kind: 'forage',
                position: new Vector3(-4, 3.1, 3),
            },
        ],
        world,
    };
}

describe('bat flight collision and avoidance', () => {
    it('rejects points and swept flight segments through rotated tall blockers', () => {
        const world = createWorld();
        assert.equal(isBatPointClear({ x: 0, y: 2, z: 0 }, world), false);
        assert.equal(isBatPointClear({ x: 0, y: 4, z: 0 }, world), true);
        assert.equal(
            isBatSegmentClear({
                from: { x: -4, y: 2, z: -3 },
                to: { x: 4, y: 2, z: 3 },
                world,
            }),
            false,
        );
        assert.equal(
            isBatSegmentClear({
                from: { x: -4, y: 4.2, z: -3 },
                to: { x: 4, y: 4.2, z: 3 },
                world,
            }),
            true,
        );
    });

    it('treats the camera and avatar as gentle dynamic flight blockers', () => {
        const world = { ...createWorld(), obstacles: [] };
        const avoid = [{ center: { x: 0, y: 2.5, z: 0 }, radius: 1 }];
        assert.equal(
            isBatSegmentClear({
                avoid,
                from: { x: -4, y: 2.5, z: 0 },
                to: { x: 4, y: 2.5, z: 0 },
                world,
            }),
            false,
        );

        const habitat = createHabitat(world);
        const target = createBatAvoidanceWaypoint({
            current: { x: 0.2, y: 2.5, z: 0 },
            habitat,
            seed: 19,
            threat: avoid[0],
        });
        assert.ok(target);
        assert.ok(target.y > avoid[0].center.y + avoid[0].radius);
        assert.ok(
            Math.hypot(
                target.x - avoid[0].center.x,
                target.z - avoid[0].center.z,
            ) > 1,
        );
    });

    it('tries only bounded candidates and never falls back through a blocker', () => {
        const habitat = createHabitat();
        const selected = chooseBatWaypoint({
            avoid: [],
            current: new Vector3(-4, 2.4, -3),
            habitat,
            random: () => 0,
            startIndex: 0,
        });
        assert.equal(selected?.waypoint.id, 'clear-b');

        const blockedHabitat = {
            ...habitat,
            waypoints: Array.from(
                { length: batMaxPathCandidateAttempts + 4 },
                (_, index) => ({
                    id: `blocked-${index}`,
                    kind: 'circle' as const,
                    position: new Vector3(4, 2.4, 3),
                }),
            ),
        };
        assert.equal(
            chooseBatWaypoint({
                avoid: [],
                current: new Vector3(-4, 2.4, -3),
                habitat: blockedHabitat,
                random: () => 0,
                startIndex: 0,
            }),
            null,
        );
    });
});

describe('bat habitat selection', () => {
    function createGarden(withCover: boolean): Stack[] {
        const stacks: Stack[] = [];
        for (let x = -3; x <= 3; x += 1) {
            for (let z = -3; z <= 3; z += 1) {
                const blocks = [
                    {
                        id: `ground:${x}:${z}`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ];
                if (withCover && x === -3 && z === -3) {
                    blocks.push({ id: 'tree:one', name: 'Tree', rotation: 0 });
                }
                stacks.push({ blocks, position: new Vector3(x, 0, z) });
            }
        }
        return stacks;
    }

    it('requires sufficient garden area and natural cover', () => {
        assert.deepEqual(
            createBatHabitats({
                blockData: getLocalSandboxBlockData(),
                seedKey: 'garden-17:2026-08-23',
                stacks: createGarden(false),
            }),
            [],
        );
        assert.deepEqual(
            createBatHabitats({
                blockData: getLocalSandboxBlockData(),
                seedKey: 'small',
                stacks: createGarden(true).slice(0, 15),
            }),
            [],
        );
    });

    it('repeats the same seeded habitat and bounded air path', () => {
        const input = {
            blockData: getLocalSandboxBlockData(),
            seedKey: 'garden-17:2026-08-23',
            stacks: createGarden(true),
        };
        const first = createBatHabitats(input);
        const second = createBatHabitats(input);
        assert.equal(first.length, 1);
        assert.deepEqual(
            first.map((habitat) =>
                habitat.waypoints.map((waypoint) =>
                    waypoint.position.toArray(),
                ),
            ),
            second.map((habitat) =>
                habitat.waypoints.map((waypoint) =>
                    waypoint.position.toArray(),
                ),
            ),
        );
        assert.ok(first[0].waypoints.length <= 10);
        for (const waypoint of first[0].waypoints) {
            assert.equal(
                isBatPointClear(waypoint.position, first[0].world),
                true,
            );
        }
    });
});
