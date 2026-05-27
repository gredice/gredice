import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNightOnlyBlockName, isNightTimeOfDay } from '@gredice/js/blocks';

test('marks FireflyJar as night-only', () => {
    assert.equal(isNightOnlyBlockName('FireflyJar'), true);
    assert.equal(isNightOnlyBlockName('Bucket'), false);
});

test('matches the game day-night thresholds', () => {
    assert.equal(isNightTimeOfDay(0.1), true);
    assert.equal(isNightTimeOfDay(0.5), false);
    assert.equal(isNightTimeOfDay(0.9), true);
});
