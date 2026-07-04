import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getPlantSortParentName,
    getPricedOperationRows,
    getPricedPlantRows,
    getPricedPlantSortRows,
} from './pricingRows.ts';

test('pricing rows include plants and operations only when numeric prices exist', () => {
    const plants = getPricedPlantRows([
        {
            information: { name: 'Mrkva' },
            prices: { perPlant: 1.2 },
        },
        {
            information: { name: 'Blitva' },
            prices: { perPlant: null },
        },
        {
            information: { name: 'Rajčica' },
        },
    ]);
    const operations = getPricedOperationRows([
        {
            information: { label: 'Zalijevanje' },
            prices: { perOperation: 2 },
        },
        {
            information: { label: 'Berba' },
        },
    ]);

    assert.deepEqual(
        plants.map((plant) => plant.information.name),
        ['Mrkva'],
    );
    assert.deepEqual(
        operations.map((operation) => operation.information.label),
        ['Zalijevanje'],
    );
    assert.equal(plants[0]?.prices.perPlant, 1.2);
    assert.equal(operations[0]?.prices.perOperation, 2);
});

test('pricing rows include only plant sorts with their own numeric price', () => {
    const sorts = getPricedPlantSortRows([
        {
            information: {
                name: 'Roma',
                plant: { information: { name: 'Rajčica' } },
            },
            prices: { perPlant: 1.7 },
        },
        {
            information: {
                name: 'Nantes',
                plant: { information: { name: 'Mrkva' } },
            },
            prices: { perPlant: 1.1 },
        },
        {
            information: {
                name: 'Cherry',
                plant: { information: { name: 'Rajčica' } },
            },
        },
    ]);

    assert.deepEqual(
        sorts.map(
            (sort) =>
                `${getPlantSortParentName(sort)}: ${sort.information.name}`,
        ),
        ['Mrkva: Nantes', 'Rajčica: Roma'],
    );
    assert.equal(sorts[0]?.prices.perPlant, 1.1);
});
