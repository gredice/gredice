import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    resolveWaterFoamCorners,
    resolveWaterFoamEdges,
} from './waterBlockFoam';

function waterBlock(id: string): Block {
    return { id, name: 'Block_Water', rotation: 0 };
}

function grassBlock(id: string): Block {
    return { id, name: 'Block_Grass', rotation: 0 };
}

function sandBlock(id: string): Block {
    return { id, name: 'Block_Sand', rotation: 0 };
}

function grassAngleBlock(id: string): Block {
    return { id, name: 'Block_Grass_Angle', rotation: 0 };
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

    it('keeps foam when adjacent stacks contain no water', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [grassBlock('grass-a')]),
            stack(0, 1, [grassBlock('grass-b'), grassBlock('grass-c')]),
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

    it('removes foam when adjacent water is on the same stack level', () => {
        const blockData = getLocalSandboxBlockData();
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [sandBlock('sand-a'), currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [sandBlock('sand-b'), waterBlock('water-b')]),
            stack(0, 1, [sandBlock('sand-c'), waterBlock('water-c')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                blockData,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 0, 1, 0],
        );
    });

    it('keeps foam when adjacent water is on a lower stack level', () => {
        const blockData = getLocalSandboxBlockData();
        const currentWater = waterBlock('water-upper');
        const currentStack = stack(0, 0, [
            sandBlock('sand-a'),
            waterBlock('water-lower'),
            currentWater,
        ]);
        const stacks = [
            currentStack,
            stack(1, 0, [sandBlock('sand-b'), waterBlock('water-east')]),
            stack(0, 1, [sandBlock('sand-c'), waterBlock('water-south')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                blockData,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 1, 1, 1],
        );
    });

    it('removes foam when shaped and standalone water ranges overlap', () => {
        const blockData = getLocalSandboxBlockData();
        const currentWater = waterBlock('water-shaped');
        const currentStack = stack(0, 0, [
            grassAngleBlock('angle-a'),
            currentWater,
        ]);
        const stacks = [currentStack, stack(1, 0, [waterBlock('water-east')])];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                blockData,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 0, 1, 1],
        );
    });

    it('keeps foam for unplaced water previews', () => {
        const currentWater = waterBlock('water-preview');
        const currentStack = stack(0, 0, [sandBlock('sand-a')]);
        const stacks = [
            currentStack,
            stack(1, 0, [sandBlock('sand-b'), waterBlock('water-east')]),
            stack(0, 1, [sandBlock('sand-c'), waterBlock('water-south')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                blockData: getLocalSandboxBlockData(),
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 1, 1, 1],
        );
    });
});

describe('resolveWaterFoamCorners', () => {
    it('adds foam to corners touching non-water diagonally', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(-1, 0, [waterBlock('water-west')]),
            stack(0, -1, [waterBlock('water-north')]),
            stack(1, 0, [waterBlock('water-east')]),
            stack(0, 1, [waterBlock('water-south')]),
            stack(1, 1, [waterBlock('water-southeast')]),
            stack(-1, -1, [grassBlock('grass-northwest')]),
        ];

        assert.deepEqual(
            resolveWaterFoamCorners({
                block: currentWater,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 1, 1, 0],
        );
    });
});
