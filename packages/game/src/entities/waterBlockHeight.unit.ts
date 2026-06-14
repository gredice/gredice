import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    defaultWaterBlockVisualHeight,
    waterBlockBottomOverlap,
} from './waterBlockGeometry';
import {
    getWaterBlockCenterY,
    getWaterBlockVerticalRange,
    getWaterBlockVisualHeight,
    shapedTerrainWaterTopInset,
} from './waterBlockHeight';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

function stack(blocks: Block[]): Stack {
    return {
        blocks,
        position: new Vector3(0, 0, 0),
    };
}

describe('getWaterBlockVisualHeight', () => {
    const shapedTerrainWaterHeight =
        defaultWaterBlockVisualHeight - shapedTerrainWaterTopInset;

    it('uses the default height for unsupported water blocks', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([water]);

        assert.equal(
            getWaterBlockVisualHeight({
                block: water,
                blockData: getLocalSandboxBlockData(),
                stack: currentStack,
            }),
            defaultWaterBlockVisualHeight,
        );
    });

    it('matches water height to the angle block directly below it', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([
            block('angle-a', 'Block_Grass_Angle'),
            water,
        ]);

        assert.equal(
            getWaterBlockVisualHeight({
                block: water,
                blockData: getLocalSandboxBlockData(),
                stack: currentStack,
            }),
            shapedTerrainWaterHeight,
        );
    });

    it('matches water height to the corner block directly below it', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([
            block('corner-a', 'Block_Sand_Reverse_Corner'),
            water,
        ]);

        assert.equal(
            getWaterBlockVisualHeight({
                block: water,
                blockData: getLocalSandboxBlockData(),
                stack: currentStack,
            }),
            shapedTerrainWaterHeight,
        );
    });

    it('keeps the default height when the support block is not an edge or corner terrain block', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([block('grass-a', 'Block_Grass'), water]);

        assert.equal(
            getWaterBlockVisualHeight({
                block: water,
                blockData: getLocalSandboxBlockData(),
                stack: currentStack,
            }),
            defaultWaterBlockVisualHeight,
        );
    });

    it('aligns shaped terrain water with a standalone water block top', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([
            block('corner-a', 'Block_Sand_Reverse_Corner'),
            water,
        ]);
        const range = getWaterBlockVerticalRange({
            block: water,
            blockData: getLocalSandboxBlockData(),
            stack: currentStack,
        });
        const waterTop =
            defaultWaterBlockVisualHeight - waterBlockBottomOverlap;

        assert.deepEqual(range, { min: 0, max: waterTop });
        assert.equal(
            getWaterBlockCenterY({
                block: water,
                blockData: getLocalSandboxBlockData(),
                stack: currentStack,
            }),
            waterTop / 2,
        );
    });

    it('keeps normal water above its support block', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([block('sand-a', 'Block_Sand'), water]);
        const range = getWaterBlockVerticalRange({
            block: water,
            blockData: getLocalSandboxBlockData(),
            stack: currentStack,
        });

        assert.deepEqual(range, { min: 0.34, max: 0.74 });
    });
});
