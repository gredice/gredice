import assert from 'node:assert/strict';
import test from 'node:test';
import { getAchievementProgress } from './progression';

test('levels have increasing thresholds and exact boundary progress', () => {
    for (const [count, level] of [
        [0, 1],
        [1, 2],
        [2, 2],
        [3, 3],
        [6, 4],
        [10, 5],
        [15, 6],
        [21, 7],
        [28, 8],
        [34, 8],
        [36, 9],
    ]) {
        const result = getAchievementProgress(count);
        assert.equal(result.level, level);
        assert.equal(result.xp, count * 100);
        assert.ok(result.progress >= 0 && result.progress < 1);
        assert.ok(result.xpToNextLevel > 0);
    }
    assert.equal(getAchievementProgress(3).progress, 0);
    assert.equal(getAchievementProgress(5).xpToNextLevel, 100);
});

test('invalid counts cannot produce invalid avatar levels', () => {
    for (const count of [NaN, Infinity, -1]) {
        assert.equal(getAchievementProgress(count).level, 1);
        assert.equal(getAchievementProgress(count).xp, 0);
    }
    assert.equal(getAchievementProgress(2.8).achievementCount, 2);
});
