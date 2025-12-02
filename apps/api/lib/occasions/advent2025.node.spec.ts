import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getAdventDayAvailableAt,
    getCurrentAdventDay,
    isAdventDayAvailable,
} from './advent2025';

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
    it('should return Dec 30 10:00 UTC for day 1 (midnight Dec 1 in UTC+14)', () => {
        const availableAt = getAdventDayAvailableAt(1);
        // Day 1 = Dec 1 midnight in UTC+14 = Nov 30 10:00 UTC
        assert.strictEqual(availableAt.getUTCFullYear(), 2025);
        assert.strictEqual(availableAt.getUTCMonth(), 10); // November (0-indexed)
        assert.strictEqual(availableAt.getUTCDate(), 30);
        assert.strictEqual(availableAt.getUTCHours(), 10);
        assert.strictEqual(availableAt.getUTCMinutes(), 0);
    });

    it('should return Dec 1 10:00 UTC for day 2', () => {
        const availableAt = getAdventDayAvailableAt(2);
        // Day 2 = Dec 2 midnight in UTC+14 = Dec 1 10:00 UTC
        assert.strictEqual(availableAt.getUTCFullYear(), 2025);
        assert.strictEqual(availableAt.getUTCMonth(), 11); // December
        assert.strictEqual(availableAt.getUTCDate(), 1);
        assert.strictEqual(availableAt.getUTCHours(), 10);
    });

    it('should return Dec 23 10:00 UTC for day 24', () => {
        const availableAt = getAdventDayAvailableAt(24);
        // Day 24 = Dec 24 midnight in UTC+14 = Dec 23 10:00 UTC
        assert.strictEqual(availableAt.getUTCFullYear(), 2025);
        assert.strictEqual(availableAt.getUTCMonth(), 11); // December
        assert.strictEqual(availableAt.getUTCDate(), 23);
        assert.strictEqual(availableAt.getUTCHours(), 10);
    });
});

describe('getCurrentAdventDay', () => {
    it('should return 0 before December 1st starts in UTC+14 (Nov 30 09:59 UTC)', () => {
        // Nov 30 09:59 UTC -> Nov 30 23:59 UTC+14 -> still Nov 30, day 0
        const beforeAdvent = new Date(Date.UTC(2025, 10, 30, 9, 59, 59));
        assert.strictEqual(getCurrentAdventDay(beforeAdvent), 0);
    });

    it('should return 1 when Dec 1st starts in UTC+14 (Nov 30 10:00 UTC)', () => {
        // Nov 30 10:00 UTC -> Dec 1 00:00 UTC+14 -> day 1
        const dec1StartsUtc14 = new Date(Date.UTC(2025, 10, 30, 10, 0, 0));
        assert.strictEqual(getCurrentAdventDay(dec1StartsUtc14), 1);
    });

    it('should return 1 on December 1st at midnight CET', () => {
        // Dec 1 00:00:01 CET = Nov 30 23:00:01 UTC
        // In UTC+14: Dec 1 13:00:01 -> day 1
        const dec1Midnight = cetDate(2025, 12, 1, 0, 0, 1);
        assert.strictEqual(getCurrentAdventDay(dec1Midnight), 1);
    });

    it('should return 2 when Dec 2nd starts in UTC+14 (Dec 1 10:00 UTC)', () => {
        // Dec 1 10:00 UTC -> Dec 2 00:00 UTC+14 -> day 2
        const dec2StartsUtc14 = new Date(Date.UTC(2025, 11, 1, 10, 0, 0));
        assert.strictEqual(getCurrentAdventDay(dec2StartsUtc14), 2);
    });

    it('should return 3 on December 3rd at midnight CET', () => {
        // Dec 3 00:00:01 CET = Dec 2 23:00:01 UTC
        // In UTC+14: Dec 3 13:00:01 -> day 3
        const dec3Midnight = cetDate(2025, 12, 3, 0, 0, 1);
        assert.strictEqual(getCurrentAdventDay(dec3Midnight), 3);
    });

    it('should return 4 in late afternoon/evening Dec 3rd CET (because in UTC+14 it is already Dec 4)', () => {
        // Dec 3 10:00 CET = Dec 3 09:00 UTC
        // In UTC+14: Dec 3 23:00 -> still day 3
        const dec3Morning = cetDate(2025, 12, 3, 10, 0, 0);
        assert.strictEqual(getCurrentAdventDay(dec3Morning), 3);

        // Dec 3 11:00 CET = Dec 3 10:00 UTC
        // In UTC+14: Dec 4 00:00 -> day 4!
        const dec3At11 = cetDate(2025, 12, 3, 11, 0, 0);
        assert.strictEqual(getCurrentAdventDay(dec3At11), 4);
    });

    it('should return 24 when Dec 24 is current in UTC+14', () => {
        // Dec 24 in UTC+14 runs from Dec 23 10:00 UTC to Dec 24 09:59 UTC
        // Dec 23 10:00 UTC = Dec 23 11:00 CET
        const dec24StartsUtc14 = new Date(Date.UTC(2025, 11, 23, 10, 0, 0));
        assert.strictEqual(getCurrentAdventDay(dec24StartsUtc14), 24);
    });

    it('should return 0 on December 25th (after advent)', () => {
        // Dec 25 00:00:01 CET = Dec 24 23:00:01 UTC
        // In UTC+14: Dec 25 13:00:01 -> day 25, but that's > 24, so return 0
        const dec25 = cetDate(2025, 12, 25, 0, 0, 1);
        assert.strictEqual(getCurrentAdventDay(dec25), 0);
    });

    it('should return 0 in January (after advent)', () => {
        const jan1 = cetDate(2026, 1, 1, 12, 0, 0);
        assert.strictEqual(getCurrentAdventDay(jan1), 0);
    });
});

describe('isAdventDayAvailable', () => {
    describe('day 3 availability from CET perspective', () => {
        it('should be available on Dec 2nd at 23:59 CET (day 3 in UTC+14)', () => {
            // Dec 2 23:59 CET = Dec 2 22:59 UTC
            // Day 3 starts at Dec 2 10:00 UTC, so it HAS started
            // In UTC+14: Dec 2 22:59 + 14h = Dec 3 12:59 -> day 3
            const dec2Late = cetDate(2025, 12, 2, 23, 59, 0);
            assert.strictEqual(isAdventDayAvailable(3, dec2Late), true);
        });

        it('should be available at Dec 3rd 00:00:01 CET', () => {
            // Dec 3 00:00:01 CET = Dec 2 23:00:01 UTC
            // Day 3 available at Dec 2 10:00 UTC - already past
            // Current day: Dec 2 23:00 UTC + 14h = Dec 3 13:00 UTC+14 -> day 3
            const dec3Midnight = cetDate(2025, 12, 3, 0, 0, 1);
            assert.strictEqual(isAdventDayAvailable(3, dec3Midnight), true);
        });

        it('should be available until 10:59 CET on Dec 3rd (while still day 3 in UTC+14)', () => {
            // Dec 3 10:00 CET = Dec 3 09:00 UTC
            // In UTC+14: Dec 3 23:00 -> still day 3
            const dec3Morning = cetDate(2025, 12, 3, 10, 0, 0);
            assert.strictEqual(isAdventDayAvailable(3, dec3Morning), true);

            // Dec 3 10:59 CET = Dec 3 09:59 UTC
            // In UTC+14: Dec 3 23:59 -> still day 3
            const dec3At1059 = cetDate(2025, 12, 3, 10, 59, 59);
            assert.strictEqual(isAdventDayAvailable(3, dec3At1059), true);
        });

        it('should NOT be available after 11:00 CET on Dec 3rd (it becomes day 4 in UTC+14)', () => {
            // Dec 3 11:00 CET = Dec 3 10:00 UTC
            // In UTC+14: Dec 4 00:00 -> day 4, so day 3 is no longer available
            const dec3At11 = cetDate(2025, 12, 3, 11, 0, 0);
            assert.strictEqual(isAdventDayAvailable(3, dec3At11), false);
        });

        it('should NOT be available on Dec 4th (day 3 is past)', () => {
            const dec4 = cetDate(2025, 12, 4, 0, 0, 1);
            assert.strictEqual(isAdventDayAvailable(3, dec4), false);
        });
    });

    describe('day 1 availability', () => {
        it('should NOT be available on Nov 30th before 11:00 CET', () => {
            // Day 1 available at Nov 30 10:00 UTC = Nov 30 11:00 CET
            const nov30Early = cetDate(2025, 11, 30, 10, 59, 59);
            assert.strictEqual(isAdventDayAvailable(1, nov30Early), false);
        });

        it('should be available on Nov 30th at 11:00 CET', () => {
            // Day 1 available at Nov 30 10:00 UTC = Nov 30 11:00 CET
            // Current day at Nov 30 10:00 UTC: Nov 30 10:00 + 14h = Dec 1 00:00 UTC+14 -> day 1
            const nov30At11 = cetDate(2025, 11, 30, 11, 0, 0);
            assert.strictEqual(isAdventDayAvailable(1, nov30At11), true);
        });

        it('should be available on Dec 1st morning CET (until 10:59)', () => {
            // Dec 1 10:00 CET = Dec 1 09:00 UTC
            // In UTC+14: Dec 1 23:00 -> still day 1
            const dec1Morning = cetDate(2025, 12, 1, 10, 0, 0);
            assert.strictEqual(isAdventDayAvailable(1, dec1Morning), true);
        });

        it('should NOT be available on Dec 1st after 11:00 CET (becomes day 2 in UTC+14)', () => {
            // Dec 1 11:00 CET = Dec 1 10:00 UTC
            // In UTC+14: Dec 2 00:00 -> day 2
            const dec1At11 = cetDate(2025, 12, 1, 11, 0, 0);
            assert.strictEqual(isAdventDayAvailable(1, dec1At11), false);
        });

        it('should NOT be available on Dec 2nd (day 1 is past)', () => {
            const dec2 = cetDate(2025, 12, 2, 12, 0, 0);
            assert.strictEqual(isAdventDayAvailable(1, dec2), false);
        });
    });

    describe('future days', () => {
        it('should NOT allow opening day 5 on day 3', () => {
            const dec3 = cetDate(2025, 12, 3, 0, 0, 1);
            assert.strictEqual(isAdventDayAvailable(5, dec3), false);
        });

        it('should NOT allow opening day 24 on day 1', () => {
            const dec1 = cetDate(2025, 12, 1, 0, 0, 1);
            assert.strictEqual(isAdventDayAvailable(24, dec1), false);
        });
    });

    describe('past days', () => {
        it('should NOT allow opening day 1 on day 3', () => {
            const dec3 = cetDate(2025, 12, 3, 0, 0, 1);
            assert.strictEqual(isAdventDayAvailable(1, dec3), false);
        });

        it('should NOT allow opening day 2 on day 5', () => {
            const dec5 = cetDate(2025, 12, 5, 0, 0, 1);
            assert.strictEqual(isAdventDayAvailable(2, dec5), false);
        });
    });

    describe('edge cases', () => {
        it('should handle day 24 (last day) - available from Dec 23 11:00 CET', () => {
            // Day 24 in UTC+14 starts at Dec 23 10:00 UTC = Dec 23 11:00 CET
            const dec23At11 = cetDate(2025, 12, 23, 11, 0, 0);
            assert.strictEqual(isAdventDayAvailable(24, dec23At11), true);
        });

        it('should NOT allow any day after Dec 24', () => {
            const dec25 = cetDate(2025, 12, 25, 12, 0, 0);
            // Current day is 0 (past advent), so no day is available
            assert.strictEqual(isAdventDayAvailable(1, dec25), false);
            assert.strictEqual(isAdventDayAvailable(24, dec25), false);
        });

        it('should NOT allow invalid day numbers', () => {
            const dec3 = cetDate(2025, 12, 3, 0, 0, 1);
            assert.strictEqual(isAdventDayAvailable(0, dec3), false);
            assert.strictEqual(isAdventDayAvailable(25, dec3), false);
        });
    });
});

describe('repro day 3 on midnight CET', () => {
    it('should allow day 3 at 2025-12-03T00:00:01+01:00 (CET)', () => {
        // This was the original failing scenario
        // 2025-12-03T00:00:01+01:00 = 2025-12-02T23:00:01Z (UTC)
        const bugScenario = new Date('2025-12-03T00:00:01+01:00');
        assert.strictEqual(isAdventDayAvailable(3, bugScenario), true);
    });

    it('should return day 3 as current day at 2025-12-03T00:00:01+01:00', () => {
        const bugScenario = new Date('2025-12-03T00:00:01+01:00');
        assert.strictEqual(getCurrentAdventDay(bugScenario), 3);
    });

    it('day 3 should be available (started) at 2025-12-03T00:00:01+01:00', () => {
        const bugScenario = new Date('2025-12-03T00:00:01+01:00');
        const day3AvailableAt = getAdventDayAvailableAt(3);
        // Day 3 starts at Dec 2 10:00 UTC
        // Bug scenario is Dec 2 23:00 UTC, which is after Dec 2 10:00 UTC
        assert.ok(
            bugScenario >= day3AvailableAt,
            `Expected ${bugScenario.toISOString()} >= ${day3AvailableAt.toISOString()}`,
        );
    });
});
