import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getSunflowerDropSpawnChance,
    SUNFLOWER_DROP_BASE_SPAWN_CHANCE,
} from './sunflowerDropChance';

function assertNearlyEqual(actual: number, expected: number) {
    assert.ok(
        Math.abs(actual - expected) < Number.EPSILON,
        `Expected ${actual} to equal ${expected}`,
    );
}

describe('sunflower drop spawn chance', () => {
    it('keeps the existing chance for one sunflower', () => {
        assertNearlyEqual(
            getSunflowerDropSpawnChance(1),
            SUNFLOWER_DROP_BASE_SPAWN_CHANCE,
        );
    });

    it('increases chance with each additional sunflower', () => {
        assertNearlyEqual(
            getSunflowerDropSpawnChance(2),
            1 - (1 - SUNFLOWER_DROP_BASE_SPAWN_CHANCE) ** 2,
        );
        assertNearlyEqual(
            getSunflowerDropSpawnChance(3),
            1 - (1 - SUNFLOWER_DROP_BASE_SPAWN_CHANCE) ** 3,
        );
        assert.ok(
            getSunflowerDropSpawnChance(3) > getSunflowerDropSpawnChance(2),
        );
        assert.ok(
            getSunflowerDropSpawnChance(2) > getSunflowerDropSpawnChance(1),
        );
    });

    it('does not create a chance without sunflowers', () => {
        assert.equal(getSunflowerDropSpawnChance(0), 0);
        assert.equal(getSunflowerDropSpawnChance(-1), 0);
    });

    it('never exceeds certainty', () => {
        assert.equal(getSunflowerDropSpawnChance(1_000), 1);
    });
});
