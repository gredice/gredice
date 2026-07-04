import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicGardenResponse } from '@gredice/client';
import {
    calculatePublicGardenStackStats,
    formatGardenAreaSquareMeters,
    formatGardenSunflowerPrice,
} from './publicGardenFormatting.ts';

const stacks: PublicGardenResponse['stacks'] = {
    '0': {
        '0': [
            {
                id: 'grass-1',
                name: 'Block_Grass',
                rotation: 0,
                variant: null,
            },
            {
                id: 'stand-1',
                name: 'LemonadeStand',
                rotation: 1,
                variant: null,
            },
        ],
    },
    '1': {
        '0': [
            {
                id: 'grass-2',
                name: 'Block_Grass',
                rotation: 0,
                variant: null,
            },
        ],
    },
};

test('calculatePublicGardenStackStats counts block footprints, instances and sunflower prices', () => {
    assert.deepEqual(
        calculatePublicGardenStackStats(stacks, [
            {
                information: { name: 'Block_Grass' },
                attributes: {},
                prices: { sunflowers: 2 },
            },
            {
                information: { name: 'LemonadeStand' },
                attributes: { spanWidth: 3, spanDepth: 2 },
                prices: { sunflowers: 140 },
            },
        ]),
        {
            areaSquareMeters: 6,
            blockCount: 3,
            totalSunflowerPrice: 144,
        },
    );
});

test('calculatePublicGardenStackStats falls back to stack cells when block directory data is unavailable', () => {
    assert.deepEqual(calculatePublicGardenStackStats(stacks), {
        areaSquareMeters: 2,
        blockCount: 3,
        totalSunflowerPrice: null,
    });
});

test('garden stat formatters include Croatian units and unknown fallbacks', () => {
    assert.equal(formatGardenAreaSquareMeters(6), '6 m²');
    assert.equal(formatGardenSunflowerPrice(1440), '1.440 suncokreta');
    assert.equal(formatGardenSunflowerPrice(null), '—');
});
