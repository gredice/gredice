import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    calendarDateIsInRange,
    formatCalendarDateKey,
    getCalendarMonthCells,
    getInitialCalendarMonth,
    parseCalendarDateKey,
} from './calendarDateUtils';

describe('calendar date utilities', () => {
    test('parses and formats local calendar date keys without timezone shifts', () => {
        const date = parseCalendarDateKey('2026-08-02');

        assert.ok(date);
        assert.equal(formatCalendarDateKey(date), '2026-08-02');
        assert.equal(parseCalendarDateKey('2026-02-30'), null);
        assert.equal(parseCalendarDateKey('02. 08. 2026.'), null);
    });

    test('builds a stable Monday-first six-week grid', () => {
        const cells = getCalendarMonthCells(new Date(2026, 7, 1, 12));

        assert.equal(cells.length, 42);
        assert.equal(cells[0], null);
        assert.equal(cells[5]?.getDate(), 1);
        assert.equal(cells[35]?.getDate(), 31);
        assert.equal(cells[36], null);
    });

    test('enforces inclusive date bounds', () => {
        const minimumDate = parseCalendarDateKey('2026-08-02');
        const maximumDate = parseCalendarDateKey('2026-08-05');

        assert.ok(minimumDate);
        assert.ok(maximumDate);
        assert.equal(
            calendarDateIsInRange(minimumDate, minimumDate, maximumDate),
            true,
        );
        assert.equal(
            calendarDateIsInRange(
                new Date(2026, 7, 6, 12),
                minimumDate,
                maximumDate,
            ),
            false,
        );
    });

    test('opens on the selected date or the nearest allowed month', () => {
        const minimumDate = parseCalendarDateKey('2026-08-02');
        const maximumDate = parseCalendarDateKey('2026-10-05');
        const selectedDate = parseCalendarDateKey('2026-09-12');

        assert.ok(minimumDate);
        assert.ok(maximumDate);
        assert.ok(selectedDate);
        assert.equal(
            formatCalendarDateKey(
                getInitialCalendarMonth({
                    maximumDate,
                    minimumDate,
                    referenceDate: new Date(2025, 0, 1, 12),
                    selectedDate,
                }),
            ),
            '2026-09-01',
        );
        assert.equal(
            formatCalendarDateKey(
                getInitialCalendarMonth({
                    maximumDate,
                    minimumDate,
                    referenceDate: new Date(2025, 0, 1, 12),
                    selectedDate: null,
                }),
            ),
            '2026-08-01',
        );
    });
});
