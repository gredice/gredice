import assert from 'node:assert/strict';
import test from 'node:test';
import { selectSeedsForPlantSort } from '../app/biljke/[alias]/plantSortSeeds.ts';

const seeds = [
    {
        id: 3,
        information: {
            name: 'Sjeme Žuta',
            plantSort: { id: 12 },
        },
    },
    {
        id: 1,
        information: {
            name: 'Sjeme Abeceda',
            plantSort: { id: 12 },
        },
    },
    {
        id: 2,
        information: {
            name: 'Sjeme druge sorte',
            plantSort: { id: 99 },
        },
    },
];

test('selects and alphabetically orders seeds linked to the plant sort', () => {
    assert.deepEqual(
        selectSeedsForPlantSort(seeds, 12).map((seed) => seed.id),
        [1, 3],
    );
});

test('returns an empty list when the plant sort has no linked seeds', () => {
    assert.deepEqual(selectSeedsForPlantSort(seeds, 404), []);
});
