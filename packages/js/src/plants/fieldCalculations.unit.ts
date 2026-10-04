import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { calculatePlantsPerField } from './fieldCalculations';

const originalWarn = console.warn;

afterEach(() => {
    console.warn = originalWarn;
});

test('identifies the plant when the seeding distance is too large', () => {
    const warnings: string[] = [];
    console.warn = (message: string) => warnings.push(message);

    const result = calculatePlantsPerField(90, 'Suncokret');

    assert.deepEqual(result, { plantsPerRow: 1, totalPlants: 1 });
    assert.deepEqual(warnings, [
        'Plants per row is less than 1 (0) for plant "Suncokret" with seeding distance 90cm. Setting to 1.',
    ]);
});
