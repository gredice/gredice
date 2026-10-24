import assert from 'node:assert/strict';
import test from 'node:test';
import { createAllAnimalDebugStacks } from '../entities/animals/allAnimalDebugStacks';
import { faunaHeavyMockGardenProfile } from '../mockGardenProfilePolicy';
import { createMockGarden } from './useCurrentGarden';

test('default mock garden contains one spanning raised bed', () => {
    const garden = createMockGarden('summer', 'default');
    const raisedBedBlocks = garden.stacks.flatMap((stack) =>
        stack.blocks.filter((block) => block.name === 'Raised_Bed'),
    );

    assert.equal(garden.raisedBeds.length, 1);
    assert.equal(raisedBedBlocks.length, 1);
    assert.equal(garden.raisedBeds[0]?.blockId, raisedBedBlocks[0]?.id);
    assert.equal(raisedBedBlocks[0]?.rotation, 1);
});

test('fauna-heavy mock garden reuses the deterministic all-animal fixture', () => {
    const garden = createMockGarden('summer', faunaHeavyMockGardenProfile);
    const secondGarden = createMockGarden(
        'winter',
        faunaHeavyMockGardenProfile,
    );

    assert.equal(garden.id, 99995);
    assert.equal(garden.name, 'Profile fauna-heavy garden');
    assert.equal(garden.isSandbox, false);
    assert.equal(garden.isPublic, false);
    assert.deepEqual(garden.raisedBeds, []);
    assert.deepEqual(garden.stacks, createAllAnimalDebugStacks());
    assert.deepEqual(secondGarden.stacks, garden.stacks);
    assert.notStrictEqual(secondGarden.stacks, garden.stacks);
    assert.notStrictEqual(secondGarden.stacks[0], garden.stacks[0]);
});

test('dense autumn profile mixes old, standalone and articulated surfaces beside trees', () => {
    const garden = createMockGarden('summer', 'dense-autumn');
    const names = [
        'Stool',
        'GiftBox_BlueWhite',
        'WoodenBench',
        'OutletDisplayTable',
        'GardenBox',
        'StoneLarge',
        'FenceGate',
    ];
    const props = garden.stacks.filter(
        (stack) =>
            Math.abs(stack.position.x) <= 7 &&
            Math.abs(stack.position.z) <= 7 &&
            stack.blocks.some((block) => names.includes(block.name)),
    );
    const trees = garden.stacks.filter((stack) =>
        stack.blocks.some((block) => block.name === 'Tree'),
    );
    assert.equal(props.length, 50);
    assert(trees.length >= 25);
    for (const name of names)
        assert(
            props.some((stack) =>
                stack.blocks.some((block) => block.name === name),
            ),
            name,
        );
    for (const prop of props)
        assert(
            trees.some(
                (tree) =>
                    Math.hypot(
                        tree.position.x - prop.position.x,
                        tree.position.z - prop.position.z,
                    ) <= 1,
            ),
        );
});
