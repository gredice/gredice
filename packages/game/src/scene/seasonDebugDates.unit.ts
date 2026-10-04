import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGameProfileDate } from '../../../../apps/garden/app/debug/profile/game/profileDate';
import {
    createDateForGameDayOfYear,
    getGameDayOfYear,
} from '../utils/timeOfDay';
import { getSeasonDebugDates } from './seasonDebugDates';
import { getSeasonState } from './seasonState';

test('named fixtures, profile links and slider dates resolve identical seasons', () => {
    for (const year of [2024, 2026]) {
        for (const date of Object.values(getSeasonDebugDates(year))) {
            const reference = new Date(year, 0, 1, 12);
            const query = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const linked = resolveGameProfileDate(query, reference);
            const scrubbed = createDateForGameDayOfYear(
                reference,
                getGameDayOfYear(date),
            );
            assert.ok(linked);
            assert.equal(linked.getTime(), date.getTime());
            assert.deepEqual(getSeasonState(linked), getSeasonState(scrubbed));
        }
    }
});
