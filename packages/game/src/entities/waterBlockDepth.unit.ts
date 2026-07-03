import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    getWaterBlockColumnDepth,
    getWaterBlockColumnSurfaceY,
    getWaterBlockDepthSamples,
} from './waterBlockDepth';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

function stack(blocks: Block[]): Stack {
    return {
        blocks,
        position: new Vector3(0, 0, 0),
    };
}

function rounded(values: number[]) {
    return values.map((value) => Number(value.toFixed(6)));
}

describe('getWaterBlockColumnDepth', () => {
    it('counts contiguous water blocks below the visible water surface', () => {
        const shallowWater = block('water-a', 'Block_Water');
        const middleWater = block('water-b', 'Block_Water');
        const deepWater = block('water-c', 'Block_Water');
        const currentStack = stack([shallowWater, middleWater, deepWater]);

        assert.equal(
            getWaterBlockColumnDepth({
                block: deepWater,
                stack: currentStack,
            }),
            3,
        );
        assert.equal(
            getWaterBlockColumnDepth({
                block: shallowWater,
                stack: currentStack,
            }),
            3,
        );
    });

    it('stops counting at non-water support blocks', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([block('grass-a', 'Block_Grass'), water]);

        assert.equal(
            getWaterBlockColumnDepth({
                block: water,
                stack: currentStack,
            }),
            1,
        );
    });

    it('does not count separated water below another block', () => {
        const lowerWater = block('water-a', 'Block_Water');
        const upperWater = block('water-b', 'Block_Water');
        const currentStack = stack([
            lowerWater,
            block('grass-a', 'Block_Grass'),
            upperWater,
        ]);

        assert.equal(
            getWaterBlockColumnDepth({
                block: upperWater,
                stack: currentStack,
            }),
            1,
        );
    });

    it('resolves the top surface y for the full contiguous water column', () => {
        const shallowWater = block('water-a', 'Block_Water');
        const deepWater = block('water-b', 'Block_Water');
        const currentStack = stack([shallowWater, deepWater]);

        assert.equal(
            Number(
                getWaterBlockColumnSurfaceY({
                    block: shallowWater,
                    blockData: getLocalSandboxBlockData(),
                    stack: currentStack,
                }).toFixed(6),
            ),
            0.74,
        );
    });

    it('samples one flat water block as one block deep', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([block('grass-a', 'Block_Grass'), water]);

        assert.deepEqual(
            rounded(
                getWaterBlockDepthSamples({
                    block: water,
                    blockData: getLocalSandboxBlockData(),
                    stack: currentStack,
                }),
            ),
            [1, 1, 1, 1],
        );
    });

    it('samples water over angled terrain from deep edge to shallow edge', () => {
        const water = block('water-a', 'Block_Water');
        const currentStack = stack([
            block('angle-a', 'Block_Sand_Angle'),
            water,
        ]);

        assert.deepEqual(
            rounded(
                getWaterBlockDepthSamples({
                    block: water,
                    blockData: getLocalSandboxBlockData(),
                    stack: currentStack,
                }),
            ),
            [1, 1, 0, 0],
        );
    });

    it('includes upper water blocks when sampling angled terrain depth', () => {
        const lowerWater = block('water-a', 'Block_Water');
        const upperWater = block('water-b', 'Block_Water');
        const currentStack = stack([
            block('angle-a', 'Block_Sand_Angle'),
            lowerWater,
            upperWater,
        ]);

        assert.deepEqual(
            rounded(
                getWaterBlockDepthSamples({
                    block: upperWater,
                    blockData: getLocalSandboxBlockData(),
                    stack: currentStack,
                }),
            ),
            [2, 2, 1, 1],
        );
    });
});
