import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getAdventDayAvailableAt,
    getCurrentAdventDay,
    isAdventDayAvailable,
} from './advent2025';

// Default timezone for tests - CET (Central European Time)
const CET_TIMEZONE = 'Europe/Berlin';

/**
 * Helper to create a CET date (UTC+1 in winter)
 * CET is UTC+1 during winter (standard time)
 */
function cetDate(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
): Date {
    // CET is UTC+1, so we subtract 1 hour from the CET time to get UTC
    return new Date(
        Date.UTC(year, month - 1, day, hour - 1, minute, second, 0),
    );
}

describe('getAdventDayAvailableAt', () => {
    it('should return midnight of given advent day in user timezone', () => {
        // Day 1 = Dec 1 midnight in CET = Nov 30 23:00 UTC
        const day1 = getAdventDayAvailableAt(1, CET_TIMEZONE);
        assert.strictEqual(day1.getUTCFullYear(), 2025);
        assert.strictEqual(day1.getUTCMonth(), 10); // November (0-indexed)
        assert.strictEqual(day1.getUTCDate(), 30);
        assert.strictEqual(day1.getUTCHours(), 23);

        // Day 24 = Dec 24 midnight in CET = Dec 23 23:00 UTC
        const day24 = getAdventDayAvailableAt(24, CET_TIMEZONE);
        assert.strictEqual(day24.getUTCFullYear(), 2025);
        assert.strictEqual(day24.getUTCMonth(), 11); // December
        assert.strictEqual(day24.getUTCDate(), 23);
        assert.strictEqual(day24.getUTCHours(), 23);
    });
});

describe('getCurrentAdventDay', () => {
    it('should return 0 before December 1st in user timezone', () => {
        // Nov 30 23:59 CET -> still Nov 30, day 0
        const beforeAdvent = cetDate(2025, 11, 30, 23, 59, 59);
        assert.strictEqual(getCurrentAdventDay(CET_TIMEZONE, beforeAdvent), 0);
    });

    it('should return the calendar day (1-24) during advent', () => {
        assert.strictEqual(
            getCurrentAdventDay(CET_TIMEZONE, cetDate(2025, 12, 1, 0, 0, 1)),
            1,
        );
        assert.strictEqual(
            getCurrentAdventDay(CET_TIMEZONE, cetDate(2025, 12, 3, 12, 0, 0)),
            3,
        );
        assert.strictEqual(
            getCurrentAdventDay(
                CET_TIMEZONE,
                cetDate(2025, 12, 24, 23, 59, 59),
            ),
            24,
        );
    });

    it('should return 0 after December 24th', () => {
        assert.strictEqual(
            getCurrentAdventDay(CET_TIMEZONE, cetDate(2025, 12, 25, 0, 0, 1)),
            0,
        );
        assert.strictEqual(
            getCurrentAdventDay(CET_TIMEZONE, cetDate(2026, 1, 1, 12, 0, 0)),
            0,
        );
    });
});

describe('isAdventDayAvailable', () => {
    it('should only allow current day - not past days', () => {
        const dec3 = cetDate(2025, 12, 3, 12, 0, 0);
        assert.strictEqual(isAdventDayAvailable(1, CET_TIMEZONE, dec3), false);
        assert.strictEqual(isAdventDayAvailable(2, CET_TIMEZONE, dec3), false);
    });

    it('should only allow current day - not future days', () => {
        const dec3 = cetDate(2025, 12, 3, 12, 0, 0);
        assert.strictEqual(isAdventDayAvailable(4, CET_TIMEZONE, dec3), false);
        assert.strictEqual(isAdventDayAvailable(24, CET_TIMEZONE, dec3), false);
    });

    it('should allow the current day throughout the entire day in user timezone', () => {
        // Day 3 available all day on Dec 3 in CET
        assert.strictEqual(
            isAdventDayAvailable(
                3,
                CET_TIMEZONE,
                cetDate(2025, 12, 3, 0, 0, 1),
            ),
            true,
        );
        assert.strictEqual(
            isAdventDayAvailable(
                3,
                CET_TIMEZONE,
                cetDate(2025, 12, 3, 12, 0, 0),
            ),
            true,
        );
        assert.strictEqual(
            isAdventDayAvailable(
                3,
                CET_TIMEZONE,
                cetDate(2025, 12, 3, 23, 59, 59),
            ),
            true,
        );
    });

    it('should NOT allow day before midnight in user timezone', () => {
        // Dec 2 23:59 CET - day 3 should not be available yet
        assert.strictEqual(
            isAdventDayAvailable(
                3,
                CET_TIMEZONE,
                cetDate(2025, 12, 2, 23, 59, 0),
            ),
            false,
        );
    });

    it('should NOT allow day after midnight of next day', () => {
        // Dec 4 00:00:01 CET - day 3 should no longer be available
        assert.strictEqual(
            isAdventDayAvailable(
                3,
                CET_TIMEZONE,
                cetDate(2025, 12, 4, 0, 0, 1),
            ),
            false,
        );
    });

    it('should NOT allow invalid day numbers', () => {
        const dec3 = cetDate(2025, 12, 3, 12, 0, 0);
        assert.strictEqual(isAdventDayAvailable(0, CET_TIMEZONE, dec3), false);
        assert.strictEqual(isAdventDayAvailable(25, CET_TIMEZONE, dec3), false);
    });

    it('should NOT allow any day after advent ends', () => {
        const dec25 = cetDate(2025, 12, 25, 12, 0, 0);
        assert.strictEqual(isAdventDayAvailable(1, CET_TIMEZONE, dec25), false);
        assert.strictEqual(
            isAdventDayAvailable(24, CET_TIMEZONE, dec25),
            false,
        );
    });
});
