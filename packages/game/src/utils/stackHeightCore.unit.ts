import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getStackBlockHeight, getStackHeight } from './stackHeightCore';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

function stack(blocks: Block[]): Stack {
    return {
        blocks,
        position: new Vector3(0, 0, 0),
    };
}

describe('getStackHeight', () => {
    const localBlockHeight = 0.4;

    it('collapses water directly above shaped terrain into the support height', () => {
        const sandEdge = block('sand-edge', 'Block_Sand_Angle');
        const bottomWater = block('water-bottom', 'Block_Water');
        const topWater = block('water-top', 'Block_Water');
        const currentStack = stack([sandEdge, bottomWater, topWater]);
        const blockData = getLocalSandboxBlockData();

        assert.equal(
            getStackBlockHeight(blockData, currentStack, bottomWater),
            0,
        );
        assert.equal(
            getStackHeight(blockData, currentStack, bottomWater),
            localBlockHeight,
        );
        assert.equal(
            getStackHeight(blockData, currentStack, topWater),
            localBlockHeight,
        );
        assert.equal(
            getStackHeight(blockData, currentStack),
            localBlockHeight * 2,
        );
    });

    it('keeps normal water height above a flat terrain block', () => {
        const sand = block('sand', 'Block_Sand');
        const bottomWater = block('water-bottom', 'Block_Water');
        const topWater = block('water-top', 'Block_Water');
        const currentStack = stack([sand, bottomWater, topWater]);
        const blockData = getLocalSandboxBlockData();

        assert.equal(
            getStackBlockHeight(blockData, currentStack, bottomWater),
            localBlockHeight,
        );
        assert.equal(
            getStackHeight(blockData, currentStack, topWater),
            localBlockHeight * 2,
        );
        assert.equal(
            getStackHeight(blockData, currentStack),
            localBlockHeight * 3,
        );
    });
});
