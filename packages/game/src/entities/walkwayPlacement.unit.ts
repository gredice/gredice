import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getWalkwayPlacementYOffset } from './walkwayPlacement';
import { waterBlockBottomOverlap } from './waterBlockGeometry';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

function stack(blocks: Block[]): Stack {
    return { blocks, position: new Vector3() };
}

describe('getWalkwayPlacementYOffset', () => {
    for (const terrainName of [
        'Block_Grass',
        'Block_Ground',
        'Block_Snow',
        'Block_Water',
    ]) {
        it(`keeps WoodenWalkway supports embedded in ${terrainName}`, () => {
            const terrain = block('terrain', terrainName);
            const walkway = block('walkway', 'WoodenWalkway');

            assert.equal(
                getWalkwayPlacementYOffset(stack([terrain, walkway]), walkway),
                -waterBlockBottomOverlap,
            );
        });

        it(`keeps StoneWalkway above the ${terrainName} surface`, () => {
            const terrain = block('terrain', terrainName);
            const walkway = block('walkway', 'StoneWalkway');

            assert.equal(
                getWalkwayPlacementYOffset(stack([terrain, walkway]), walkway),
                0,
            );
        });
    }

    for (const walkwayName of ['WoodenWalkway', 'StoneWalkway']) {
        it(`keeps the ${walkwayName} origin unchanged without terrain support`, () => {
            const walkway = block('walkway', walkwayName);

            assert.equal(
                getWalkwayPlacementYOffset(stack([walkway]), walkway),
                0,
            );
        });
    }
});
