import assert from 'node:assert/strict';
import test from 'node:test';
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
