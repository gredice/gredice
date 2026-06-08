import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import { getGroundDecorationBlocks } from './groundDecorationBlocks';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

function stack(blocks: Block[]): Stack {
    return {
        position: new Vector3(0, 0, 0),
        blocks,
    };
}

test('skips grass and sand decoration blocks covered by water', () => {
    const grass = block('grass-low', 'Block_Grass');
    const sand = block('sand-middle', 'Block_Sand');
    const water = block('water-top', 'Block_Water');

    const decorationBlocks = getGroundDecorationBlocks([
        stack([grass, sand, water]),
    ]);

    assert.deepEqual(
        decorationBlocks.map(
            ({ block: decorationBlock }) => decorationBlock.id,
        ),
        [],
    );
});

test('keeps grass and sand decoration blocks when water is lower in the stack', () => {
    const water = block('water-low', 'Block_Water');
    const grass = block('grass-top', 'Block_Grass');
    const sand = block('sand-top', 'Block_Sand');

    const decorationBlocks = getGroundDecorationBlocks([
        stack([water, grass, sand]),
    ]);

    assert.deepEqual(
        decorationBlocks.map(
            ({ block: decorationBlock }) => decorationBlock.id,
        ),
        ['grass-top', 'sand-top'],
    );
});
