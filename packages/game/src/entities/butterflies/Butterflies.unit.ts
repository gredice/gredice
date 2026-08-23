import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import type { AnimalFlightObstacle } from '../animals/animalFlightSafety';
import type { PollinatorFlowerTarget } from '../pollinators/flowerTargets';
import {
    createApproachState,
    createButterflyHabitats,
    createMeanderState,
    createTakeoffState,
} from './Butterflies';

function stackWithBlocks(
    x: number,
    z: number,
    blocks: Array<{ id: string; name: string }>,
): Stack {
    return {
        blocks: blocks.map((block) => ({ ...block, rotation: 0 })),
        position: new Vector3(x, 0, z),
    };
}

test('creates butterfly habitat only for flowers with valid ground support', () => {
    const supportedFlower = stackWithBlocks(0, 0, [
        { id: 'grass', name: 'Block_Grass' },
        { id: 'tulip', name: 'Tulip' },
    ]);
    const unsupportedFlower = stackWithBlocks(3, 0, [
        { id: 'unsupported-tulip', name: 'Tulip' },
    ]);

    const habitats = createButterflyHabitats({
        blockData: undefined,
        garden: {
            id: 14,
            raisedBeds: [],
            stacks: [supportedFlower, unsupportedFlower],
        },
        groundDecorationDensity: 0,
    });

    assert.equal(habitats.length, 1);
    assert.ok(habitats[0]?.targets.length);
    assert.ok(
        habitats[0]?.targets.every((target) =>
            target.blockIds?.includes('tulip'),
        ),
    );
});

test('does not create a butterfly habitat without flowers', () => {
    const habitats = createButterflyHabitats({
        blockData: undefined,
        garden: {
            id: 14,
            raisedBeds: [],
            stacks: [
                stackWithBlocks(0, 0, [
                    { id: 'grass', name: 'Block_Grass' },
                    { id: 'tree', name: 'Tree' },
                ]),
            ],
        },
        groundDecorationDensity: 0,
    });

    assert.deepEqual(habitats, []);
});

test('versions a habitat when an existing flower moves', () => {
    const gardenAt = (x: number) => ({
        id: 14,
        raisedBeds: [],
        stacks: [
            stackWithBlocks(x, 0, [
                { id: 'grass', name: 'Block_Grass' },
                { id: 'tulip', name: 'Tulip' },
            ]),
        ],
    });
    const original = createButterflyHabitats({
        blockData: undefined,
        garden: gardenAt(0),
        groundDecorationDensity: 0,
    });
    const moved = createButterflyHabitats({
        blockData: undefined,
        garden: gardenAt(2),
        groundDecorationDensity: 0,
    });

    assert.equal(original.length, 1);
    assert.equal(moved.length, 1);
    assert.notEqual(original[0]?.id, moved[0]?.id);
});

test('keeps approach, initial meander, and takeoff routable through the active flower host', () => {
    const target = {
        blockIds: ['tulip'],
        id: 'tulip-target',
        kind: 'flower',
        position: new Vector3(0, 0.52, 0),
    } satisfies PollinatorFlowerTarget;
    const obstacles = [
        {
            blockIds: ['grass', 'tulip'],
            topY: 1,
            x: 0,
            z: 0,
        },
    ] satisfies AnimalFlightObstacle[];
    const now = 4;

    assert.ok(
        createApproachState({
            from: new Vector3(0.35, 1.07, 0.35),
            now,
            obstacles,
            target,
        }),
    );
    assert.ok(
        createTakeoffState({
            from: new Vector3(0, 0.555, 0),
            now,
            obstacles,
            target,
        }),
    );

    const meanderInput = {
        from: new Vector3(0, 0.9, 0),
        habitat: {
            center: new Vector3(0, 0, 0),
            id: 'host-habitat',
            seed: 1,
            targets: [target],
        },
        now,
        obstacles,
        random: () => 0,
    };
    assert.equal(createMeanderState(meanderInput), null);
    assert.ok(
        createMeanderState({
            ...meanderInput,
            ignoredBlockIds: new Set(target.blockIds),
        }),
    );
});
