import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNightOnlyBlockPurchase, isNightTimeOfDay } from '@gredice/js/blocks';

test('marks blocks with the night-only purchase attribute', () => {
    assert.equal(
        isNightOnlyBlockPurchase({
            attributes: { nightOnlyPurchase: true },
        }),
        true,
    );
    assert.equal(
        isNightOnlyBlockPurchase({
            attributes: { nightOnlyPurchase: false },
        }),
        false,
    );
});

test('matches the game day-night thresholds', () => {
    assert.equal(isNightTimeOfDay(0.1), true);
    assert.equal(isNightTimeOfDay(0.5), false);
    assert.equal(isNightTimeOfDay(0.9), true);
});
