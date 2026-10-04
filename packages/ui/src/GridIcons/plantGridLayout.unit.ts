import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plantGridLayout } from './plantGridLayout';

test('density layouts preserve every planting position, including 25 and 36', () => {
    for (const count of [1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 225]) {
        const layout = plantGridLayout(count);
        assert.ok(layout);
        assert.equal(layout.columns, Math.sqrt(count));
        assert.equal(layout.fullRows, Math.sqrt(count));
        assert.equal(layout.lastRowPlants, 0);
    }
});

test('non-square counts retain their exact count without rounding up', () => {
    for (const count of [2, 3, 5, 10, 17, 26, 37]) {
        const layout = plantGridLayout(count);
        assert.ok(layout);
        assert.equal(
            layout.fullRows * layout.columns + layout.lastRowPlants,
            count,
        );
        assert.ok(layout.lastRowPlants < layout.columns);
    }
});

test('empty and invalid counts do not invent plants', () => {
    assert.deepEqual(plantGridLayout(0), {
        columns: 1,
        fullRows: 0,
        lastRowPlants: 0,
    });
    for (const count of [
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
    ]) {
        assert.equal(plantGridLayout(count), null);
    }
});
