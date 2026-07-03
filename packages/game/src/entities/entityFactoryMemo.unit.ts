import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { areEntityFactoryPropsEqual } from './entityFactoryMemo';

type EntityFactoryMemoProps = Parameters<typeof areEntityFactoryPropsEqual>[0];

const instancedNames = ['Block_Grass'];

function createBlock(overrides: Partial<Block> = {}): Block {
    return {
        id: 'block-1',
        name: 'Block_Grass',
        rotation: 0,
        ...overrides,
    };
}

function createStack({
    blocks = [createBlock()],
    x = 1,
    y = 0,
    z = 2,
}: {
    blocks?: Block[];
    x?: number;
    y?: number;
    z?: number;
} = {}): Stack {
    return {
        position: new Vector3(x, y, z),
        blocks,
    };
}

function createProps(
    overrides: Partial<EntityFactoryMemoProps> = {},
): EntityFactoryMemoProps {
    const block = overrides.block ?? createBlock();
    const stack = overrides.stack ?? createStack({ blocks: [block] });
    return {
        name: block.name,
        stack,
        block,
        stacks: [stack],
        rotation: block.rotation,
        variant: block.variant,
        noRenderInView: instancedNames,
        ...overrides,
    };
}

describe('areEntityFactoryPropsEqual', () => {
    it('keeps equivalent instanced stacks stable when only Vector3 references change', () => {
        const previousBlock = createBlock();
        const nextBlock = createBlock();
        const previous = createProps({
            block: previousBlock,
            stack: createStack({ blocks: [previousBlock] }),
        });
        const next = createProps({
            block: nextBlock,
            stack: createStack({ blocks: [nextBlock] }),
        });

        assert.equal(areEntityFactoryPropsEqual(previous, next), true);
    });

    it('rerenders instanced blocks when their stack contents change', () => {
        const block = createBlock();
        const previous = createProps({
            block,
            stack: createStack({ blocks: [block] }),
        });
        const next = createProps({
            block,
            stack: createStack({
                blocks: [block, createBlock({ id: 'block-2' })],
            }),
        });

        assert.equal(areEntityFactoryPropsEqual(previous, next), false);
    });

    it('keeps non-instanced entities on strict stack identity', () => {
        const previousBlock = createBlock({ name: 'Tree' });
        const nextBlock = createBlock({ name: 'Tree' });
        const previous = createProps({
            name: 'Tree',
            block: previousBlock,
            stack: createStack({ blocks: [previousBlock] }),
            noRenderInView: instancedNames,
        });
        const next = createProps({
            name: 'Tree',
            block: nextBlock,
            stack: createStack({ blocks: [nextBlock] }),
            noRenderInView: instancedNames,
        });

        assert.equal(areEntityFactoryPropsEqual(previous, next), false);
    });
});
