import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { PublicGardenDetail } from '@gredice/game';
import {
    getAdjacentLandingGardenIndex,
    orderLandingGardens,
} from './landingGardenCarousel.ts';

function garden(id: number): PublicGardenDetail {
    return {
        backgroundPalette: 'current',
        farmId: 1,
        homeCamera: null,
        id,
        isPublic: true,
        isSandbox: false,
        latitude: 45.815,
        longitude: 15.982,
        name: `Vrt ${id.toString()}`,
        raisedBeds: [],
        stacks: {},
        updatedAt: '2026-08-28T12:00:00.000Z',
    };
}

test('places every owned garden before featured public gardens and removes duplicates', () => {
    const ordered = orderLandingGardens(
        [garden(7), garden(4)],
        [garden(4), garden(12), garden(15)],
    );

    assert.deepEqual(
        ordered.map((item) => [item.garden.id, item.source]),
        [
            [7, 'owned'],
            [4, 'owned'],
            [12, 'featured'],
            [15, 'featured'],
        ],
    );
});

test('wraps carousel navigation in both directions', () => {
    assert.equal(getAdjacentLandingGardenIndex(0, 4, -1), 3);
    assert.equal(getAdjacentLandingGardenIndex(3, 4, 1), 0);
    assert.equal(getAdjacentLandingGardenIndex(1, 4, 1), 2);
    assert.equal(getAdjacentLandingGardenIndex(0, 0, 1), -1);
});

test('exposes the landing experiment through managed Vercel flag discovery', () => {
    const flagsSource = readFileSync(new URL('./flags.ts', import.meta.url), {
        encoding: 'utf8',
    });
    const discoverySource = readFileSync(
        new URL('./.well-known/vercel/flags/route.ts', import.meta.url),
        { encoding: 'utf8' },
    );

    assert.match(flagsSource, /key: 'enableLandingFeaturedGardens'/u);
    assert.match(flagsSource, /adapter: vercelAdapter/u);
    assert.match(discoverySource, /getVercelProviderData\(flags\)/u);
    assert.match(discoverySource, /mergeProviderData/u);
});
