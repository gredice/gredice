import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { isWaterBlockTopSurfaceVisible } from './waterBlockSurface';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

function stack(blocks: Block[]): Stack {
    return {
        blocks,
        position: new Vector3(0, 0, 0),
    };
}

describe('isWaterBlockTopSurfaceVisible', () => {
    it('keeps the top visible when a decoration is placed above water', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([water, block('pine-a', 'Pine')]);

        assert.equal(
            isWaterBlockTopSurfaceVisible({
                block: water,
                stack: currentStack,
            }),
            true,
        );
    });

    it('hides the top only when another water block is directly above', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([water, block('water-b', 'Block_Water')]);

        assert.equal(
            isWaterBlockTopSurfaceVisible({
                block: water,
                stack: currentStack,
            }),
            false,
        );
    });

    it('keeps the top visible for the uppermost water block', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([block('water-b', 'Block_Water'), water]);

        assert.equal(
            isWaterBlockTopSurfaceVisible({
                block: water,
                stack: currentStack,
            }),
            true,
        );
    });

    it('keeps the top visible for unplaced water previews', () => {
        assert.equal(
            isWaterBlockTopSurfaceVisible({
                block: block('water-preview', 'Block_Water'),
                stack: stack([]),
            }),
            true,
        );
    });
});
