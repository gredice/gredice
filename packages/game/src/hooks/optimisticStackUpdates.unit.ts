import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { rotateBlocksInStacks } from './optimisticStackUpdates';

function createBlock(id: string, rotation = 0): Block {
    return {
        id,
        name: 'Tree',
        rotation,
    };
}

function createStack(x: number, blocks: Block[]): Stack {
    return {
        position: new Vector3(x, 0, 0),
        blocks,
    };
}

test('rotateBlocksInStacks preserves stacks that do not contain target blocks', () => {
    const targetBlock = createBlock('target');
    const untouchedBlock = createBlock('untouched');
    const targetStack = createStack(0, [targetBlock]);
    const untouchedStack = createStack(1, [untouchedBlock]);
    const stacks = [targetStack, untouchedStack];

    const rotatedStacks = rotateBlocksInStacks({
        blockIds: ['target'],
        rotation: 1,
        stacks,
    });

    assert.notEqual(rotatedStacks, stacks);
    assert.notEqual(rotatedStacks[0], targetStack);
    assert.notEqual(rotatedStacks[0]?.blocks, targetStack.blocks);
    assert.equal(rotatedStacks[0]?.blocks[0]?.rotation, 1);
    assert.equal(rotatedStacks[1], untouchedStack);
    assert.equal(rotatedStacks[1]?.blocks, untouchedStack.blocks);
    assert.equal(rotatedStacks[1]?.blocks[0], untouchedBlock);
});

test('rotateBlocksInStacks returns the original stack array when no rotation changes', () => {
    const targetBlock = createBlock('target', 2);
    const targetStack = createStack(0, [targetBlock]);
    const stacks = [targetStack];

    assert.equal(
        rotateBlocksInStacks({
            blockIds: ['target'],
            rotation: 2,
            stacks,
        }),
        stacks,
    );
});
