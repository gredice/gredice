import assert from 'node:assert/strict';
import test from 'node:test';
import { isAdventCalendarHudPeriod } from './adventCalendarPeriod';

test('shows the historical Advent HUD only during December 2025', () => {
    assert.equal(
        isAdventCalendarHudPeriod(new Date(2025, 11, 3, 12, 0, 0)),
        true,
    );
    assert.equal(
        isAdventCalendarHudPeriod(new Date(2026, 11, 3, 12, 0, 0)),
        false,
    );
    assert.equal(
        isAdventCalendarHudPeriod(new Date(2025, 10, 30, 12, 0, 0)),
        false,
    );
});
