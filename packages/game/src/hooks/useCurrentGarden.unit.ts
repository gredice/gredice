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
