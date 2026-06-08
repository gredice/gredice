import assert from 'node:assert/strict';
import test from 'node:test';
import type { EntityStandardized } from '../src/@types/EntityStandardized';
import { buildPreviousPlantNames } from '../src/automations/raisedBedImagePlantContext';

test('buildPreviousPlantNames returns deduped names for inactive plant cycles', () => {
    const plantSortsById = new Map<number, EntityStandardized>([
        [101, { id: 101, information: { name: 'Tomato' } }],
        [102, { id: 102, information: { label: 'Lettuce' } }],
        [103, { id: 103, information: { name: 'Basil' } }],
    ]);

    const names = buildPreviousPlantNames(
        {
            plantCycles: [
                { plantSortId: 101, active: false },
                { plantSortId: 102, active: false },
                { plantSortId: 101, active: false },
                { plantSortId: 103, active: true },
            ],
        },
        plantSortsById,
    );

    assert.deepStrictEqual(names, ['Tomato', 'Lettuce']);
});
