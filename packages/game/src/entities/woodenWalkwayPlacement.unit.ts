import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { waterBlockBottomOverlap } from './waterBlockGeometry';
import { getWoodenWalkwayPlacementYOffset } from './woodenWalkwayPlacement';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

function stack(blocks: Block[]): Stack {
    return { blocks, position: new Vector3() };
}

describe('getWoodenWalkwayPlacementYOffset', () => {
    for (const terrainName of ['Block_Grass', 'Block_Ground', 'Block_Water']) {
        it(`keeps a continuous top plane on ${terrainName}`, () => {
            const terrain = block('terrain', terrainName);
            const walkway = block('walkway', 'WoodenWalkway');

            assert.equal(
                getWoodenWalkwayPlacementYOffset(
                    stack([terrain, walkway]),
                    walkway,
                ),
                -waterBlockBottomOverlap,
            );
        });
    }

    it('keeps the asset origin unchanged without terrain support', () => {
        const walkway = block('walkway', 'WoodenWalkway');

        assert.equal(
            getWoodenWalkwayPlacementYOffset(stack([walkway]), walkway),
            0,
        );
    });
});
