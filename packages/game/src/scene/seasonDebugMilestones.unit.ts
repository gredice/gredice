import assert from 'node:assert/strict';
import test from 'node:test';
import { getSeasonDebugMilestones } from './seasonDebugMilestones';
import { getSeasonState } from './seasonState';

test('debug jumps use the shared season starts and phase boundaries', () => {
    for (const year of [2024, 2026]) {
        const milestones = getSeasonDebugMilestones(year);
        assert.equal(milestones.length, 6);
        for (const { key, date } of milestones) {
            const state = getSeasonState(date);
            assert.equal(date.getFullYear(), year);
            if (key.endsWith('-autumn')) {
                assert.equal(state.season, 'autumn');
                assert.equal(state.phase, key.split('-')[0]);
            } else {
                assert.equal(state.season, key);
                assert.equal(state.progress, 0);
            }
        }
    }
});
