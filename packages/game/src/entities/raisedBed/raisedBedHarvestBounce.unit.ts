import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyHarvestBasketBounces,
    resolveHarvestBasketBounces,
} from './raisedBedHarvestBounce';

test('opening a garden does not replay harvests that already happened', () => {
    const bounces = resolveHarvestBasketBounces(
        null,
        new Map([
            [1, 'full'],
            [2, 'partial'],
        ]),
    );
    assert.equal(bounces.size, 0);
});

test('a new basket drops in and a fuller one squashes', () => {
    const bounces = resolveHarvestBasketBounces(
        new Map([
            [1, 'partial'],
            [2, 'full'],
            [3, 'partial'],
        ]),
        new Map([
            [1, 'full'],
            [2, 'partial'],
            [3, 'partial'],
            [4, 'empty'],
        ]),
    );
    assert.deepEqual(
        [...bounces],
        [
            [1, 'land'],
            [4, 'harvest'],
        ],
    );
});

test('every bounce gets a new play key, so a repeat replays', () => {
    const first = applyHarvestBasketBounces(
        new Map(),
        new Map([[7, 'harvest']]),
    );
    assert.deepEqual(first.get(7), { kind: 'harvest', playKey: 1 });
    const second = applyHarvestBasketBounces(first, new Map([[7, 'land']]));
    assert.deepEqual(second.get(7), { kind: 'land', playKey: 2 });
    // Nothing new keeps the same map, so React skips the update.
    assert.equal(applyHarvestBasketBounces(second, new Map()), second);
});
