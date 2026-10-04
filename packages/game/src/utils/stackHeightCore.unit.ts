import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    getBlockDataByName,
    getStackBlockHeight,
    getStackHeight,
    isEdgeOrCornerTerrainBlockName,
} from './stackHeightCore';

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

    it('collapses swamp water directly above shaped terrain', () => {
        const sandEdge = block('sand-edge', 'Block_Sand_Angle');
        const swampWater = block('water-bottom', 'Block_Swamp_Water');
        const currentStack = stack([sandEdge, swampWater]);
        const blockData = getLocalSandboxBlockData();

        assert.equal(
            getStackBlockHeight(blockData, currentStack, swampWater),
            0,
        );
        assert.equal(getStackHeight(blockData, currentStack), localBlockHeight);
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

    it('resolves only the renamed corner-stair pair as compatibility aliases', () => {
        const blockData = getLocalSandboxBlockData();
        const currentOnly = blockData.filter(
            (entry) => entry.information.name !== 'Block_Stone_Stairs_Half',
        );
        const legacyOnly = blockData.filter(
            (entry) => entry.information.name !== 'Block_Stone_Stairs_Corner',
        );

        assert.equal(
            getBlockDataByName(currentOnly, 'Block_Stone_Stairs_Half')
                ?.information.name,
            'Block_Stone_Stairs_Corner',
        );
        assert.equal(
            getBlockDataByName(legacyOnly, 'Block_Stone_Stairs_Corner')
                ?.information.name,
            'Block_Stone_Stairs_Half',
        );
        const originalConsoleError = console.error;
        console.error = () => undefined;
        try {
            assert.equal(
                getBlockDataByName(
                    currentOnly,
                    'Block_Polished_Stone_Stairs_Half',
                ),
                undefined,
            );
        } finally {
            console.error = originalConsoleError;
        }
    });

    it('does not collapse water into stair corners', () => {
        assert.equal(
            isEdgeOrCornerTerrainBlockName('Block_Stone_Stairs_Corner'),
            false,
        );
        assert.equal(
            isEdgeOrCornerTerrainBlockName(
                'Block_Polished_Stone_Stairs_Corner',
            ),
            false,
        );
        assert.equal(
            isEdgeOrCornerTerrainBlockName('Block_Grass_Corner'),
            true,
        );
    });
});
