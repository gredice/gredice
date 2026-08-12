import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    getStackedOnWalkwayPlacementYOffset,
    getWalkwayPlacementYOffset,
    isWaterCoveredByWalkway,
} from './walkwayPlacement';
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

describe('getStackedOnWalkwayPlacementYOffset', () => {
    for (const terrainName of ['Block_Grass', 'Block_Water']) {
        it(`grounds an arch on StoneWalkway above ${terrainName}`, () => {
            const terrain = block('terrain', terrainName);
            const walkway = block('walkway', 'StoneWalkway');
            const arch = block('arch', 'HazelLightArch');

            assert.ok(
                Math.abs(
                    getStackedOnWalkwayPlacementYOffset(
                        stack([terrain, walkway, arch]),
                        arch,
                    ) + 0.036,
                ) < 0.000_001,
            );
        });

        it(`grounds an arch on WoodenWalkway above ${terrainName}`, () => {
            const terrain = block('terrain', terrainName);
            const walkway = block('walkway', 'WoodenWalkway');
            const arch = block('arch', 'HazelLightArch');

            assert.ok(
                Math.abs(
                    getStackedOnWalkwayPlacementYOffset(
                        stack([terrain, walkway, arch]),
                        arch,
                    ) + 0.064,
                ) < 0.000_001,
            );
        });
    }

    it('does not offset an arch without a walkway directly below it', () => {
        const terrain = block('terrain', 'Block_Grass');
        const arch = block('arch', 'HazelLightArch');

        assert.equal(
            getStackedOnWalkwayPlacementYOffset(stack([terrain, arch]), arch),
            0,
        );
    });
});

describe('isWaterCoveredByWalkway', () => {
    it('recognizes a walkway above a contiguous water column', () => {
        const water1 = block('water-1', 'Block_Water');
        const water2 = block('water-2', 'Block_Swamp_Water');
        const walkway = block('walkway', 'StoneWalkway');
        const waterStack = stack([water1, water2, walkway]);

        assert.equal(isWaterCoveredByWalkway(waterStack, 0), true);
        assert.equal(isWaterCoveredByWalkway(waterStack, 1), true);
    });

    it('keeps bare water and water below other decorations uncovered', () => {
        for (const waterName of ['Block_Water', 'Block_Swamp_Water']) {
            const water = block('water', waterName);

            assert.equal(isWaterCoveredByWalkway(stack([water]), 0), false);
            assert.equal(
                isWaterCoveredByWalkway(
                    stack([water, block('arch', 'HazelLightArch')]),
                    0,
                ),
                false,
            );
        }
    });
});
