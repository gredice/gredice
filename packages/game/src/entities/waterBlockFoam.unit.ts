import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { resolveWaterFoamEdges } from './waterBlockFoam';

function waterBlock(id: string): Block {
    return { id, name: 'Block_Water', rotation: 0 };
}

function grassBlock(id: string): Block {
    return { id, name: 'Block_Grass', rotation: 0 };
}

function stack(x: number, z: number, blocks: Block[]): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks,
    };
}

describe('resolveWaterFoamEdges', () => {
    it('removes foam from shared water tile edges', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [waterBlock('water-b')]),
            stack(0, 1, [waterBlock('water-c')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 0, 1, 0],
        );
    });

    it('keeps foam when the adjacent block is not water at the same stack index', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [grassBlock('grass-a')]),
            stack(0, 1, [grassBlock('grass-b'), waterBlock('water-b')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 1, 1, 1],
        );
    });
});
