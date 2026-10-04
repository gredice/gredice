import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatEndAtOffset,
    outletPlantSortFormItems,
    priceInputValue,
} from './outletOfferFormValues';

test('outletPlantSortFormItems exposes the sort per-plant price as compare price', () => {
    const [item] = outletPlantSortFormItems([
        {
            id: 42,
            information: { name: 'Rotkvica Schwarzer winter' },
            prices: { perPlant: 2.345 },
        },
    ]);

    assert.deepEqual(item, {
        value: '42',
        label: 'Rotkvica Schwarzer winter',
        comparePriceValue: '2.35',
    });
});

test('outletPlantSortFormItems leaves compare price blank without a sort price', () => {
    const [item] = outletPlantSortFormItems([{ id: 7 }]);

    assert.equal(item.comparePriceValue, '');
});

test('priceInputValue formats cents for numeric inputs', () => {
    assert.equal(priceInputValue(995), '9.95');
    assert.equal(priceInputValue(null), '');
});

test('formatEndAtOffset renders days from the current date', () => {
    assert.equal(
        formatEndAtOffset('2026-07-05T10:00', new Date('2026-06-28T10:00')),
        'Kraj ponude je za 7 dana od sada.',
    );
});

test('formatEndAtOffset renders mixed days and hours from the current date', () => {
    assert.equal(
        formatEndAtOffset('2026-06-30T13:00', new Date('2026-06-28T10:00')),
        'Kraj ponude je za 2 dana i 3 sata od sada.',
    );
});

test('formatEndAtOffset handles sub-hour and past end times', () => {
    assert.equal(
        formatEndAtOffset('2026-06-28T10:30', new Date('2026-06-28T10:00')),
        'Kraj ponude je za manje od 1 sata.',
    );
    assert.equal(
        formatEndAtOffset('2026-06-28T09:00', new Date('2026-06-28T10:00')),
        'Kraj ponude je prošao.',
    );
});
