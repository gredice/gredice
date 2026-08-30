import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { PublicGardenDetail } from '@gredice/game';
import {
    getAdjacentLandingGardenIndex,
    getVisibleLandingGardenIndexes,
    type LandingGardenCandidate,
    landingFeaturedGardenLimit,
    landingGardenIndicatorLimit,
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
        structures: [],
        updatedAt: '2026-08-28T12:00:00.000Z',
    };
}

function candidate(id: number): LandingGardenCandidate {
    return {
        garden: garden(id),
        owner: {
            avatarUrl: null,
            displayName: `Vrtlar ${id.toString()}`,
        },
    };
}

test('places every owned garden before featured public gardens and removes duplicates', () => {
    const ordered = orderLandingGardens(
        [candidate(7), candidate(4)],
        [candidate(4), candidate(12), candidate(15), candidate(12)],
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

test('keeps the garden indicator strip compact while following the selection', () => {
    assert.equal(landingFeaturedGardenLimit, 10);
    assert.equal(landingGardenIndicatorLimit, 4);
    assert.deepEqual(getVisibleLandingGardenIndexes(0, 3), [0, 1, 2]);
    assert.deepEqual(getVisibleLandingGardenIndexes(0, 10), [0, 1, 2, 3]);
    assert.deepEqual(getVisibleLandingGardenIndexes(5, 10), [4, 5, 6, 7]);
    assert.deepEqual(getVisibleLandingGardenIndexes(9, 10), [6, 7, 8, 9]);
    assert.deepEqual(getVisibleLandingGardenIndexes(0, 10, 0), []);
});

test('keeps featured gardens enabled without stale rollout flag metadata', () => {
    const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), {
        encoding: 'utf8',
    });
    const flagsSource = readFileSync(new URL('./flags.ts', import.meta.url), {
        encoding: 'utf8',
    });
    const loaderSource = readFileSync(
        new URL('./getLandingFeaturedGardens.ts', import.meta.url),
        { encoding: 'utf8' },
    );
    const playwrightConfigSource = readFileSync(
        new URL('../playwright.config.ts', import.meta.url),
        { encoding: 'utf8' },
    );
    const discoverySource = readFileSync(
        new URL('./.well-known/vercel/flags/route.ts', import.meta.url),
        { encoding: 'utf8' },
    );

    assert.match(
        pageSource,
        /const featuredGardens = await getLandingFeaturedGardens\(\);/u,
    );
    assert.doesNotMatch(pageSource, /enableLandingFeaturedGardens/u);
    assert.doesNotMatch(flagsSource, /enableLandingFeaturedGardens/u);
    assert.match(loaderSource, /AbortSignal\.timeout/u);
    assert.match(loaderSource, /init: \{ signal \}/u);
    assert.match(loaderSource, /GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE/u);
    assert.match(
        playwrightConfigSource,
        /GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE: 'true'/u,
    );
    assert.match(flagsSource, /key: 'enablePublicEnvironmentDebug'/u);
    assert.match(discoverySource, /getProviderData\(flags\)/u);
    assert.doesNotMatch(discoverySource, /mergeProviderData/u);
});
