import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createDateForGameDate,
    createDateForGameDayOfYear,
    createDateForGameTimeOfDay,
    getGameDayOfYear,
    getGameYearLengthDays,
    isGameLeapYear,
} from './timeOfDay';

function clockParts(date: Date) {
    return {
        hours: date.getHours(),
        milliseconds: date.getMilliseconds(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds(),
    };
}

/** Builds a local date for years the `Date` constructor would remap into the 1900s. */
function localDateAt(
    year: number,
    monthIndex: number,
    day: number,
    hours = 0,
    minutes = 0,
) {
    const date = new Date(2000, 0, 1, hours, minutes);
    date.setFullYear(year, monthIndex, day);
    return date;
}

function calendarParts(date: Date) {
    return {
        day: date.getDate(),
        monthIndex: date.getMonth(),
        year: date.getFullYear(),
    };
}

test('leap years decide the length of the scene year', () => {
    assert.equal(isGameLeapYear(2024), true);
    assert.equal(isGameLeapYear(2026), false);
    assert.equal(isGameLeapYear(2000), true);
    assert.equal(isGameLeapYear(1900), false);

    assert.equal(getGameYearLengthDays(2024), 366);
    assert.equal(getGameYearLengthDays(2026), 365);
    assert.equal(getGameYearLengthDays(2000), 366);
    assert.equal(getGameYearLengthDays(1900), 365);
});

test('getGameDayOfYear counts from 1 January and follows leap years', () => {
    assert.equal(getGameDayOfYear(new Date(2026, 0, 1, 0, 0)), 1);
    assert.equal(getGameDayOfYear(new Date(2026, 11, 31, 23, 59)), 365);
    assert.equal(getGameDayOfYear(new Date(2024, 1, 29, 12, 0)), 60);
    assert.equal(getGameDayOfYear(new Date(2024, 11, 31, 12, 0)), 366);

    // Autumn sits on the same day index whatever the clock says.
    assert.equal(
        getGameDayOfYear(new Date(2026, 9, 15, 0, 0)),
        getGameDayOfYear(new Date(2026, 9, 15, 23, 59, 59, 999)),
    );

    // An unreadable date falls back to the first day instead of NaN.
    assert.equal(getGameDayOfYear(new Date(Number.NaN)), 1);
});

test('a year before 100 keeps its own leap rule instead of the 1900s', () => {
    // `Date.UTC` and `new Date(year, ...)` would read year 0 as 1900, which is
    // not a leap year, and drop 29 December onwards by a day.
    const lastDayOfYearZero = localDateAt(0, 11, 31, 8, 30);
    assert.equal(getGameYearLengthDays(0), 366);
    assert.equal(getGameDayOfYear(lastDayOfYearZero), 366);
    assert.equal(getGameDayOfYear(localDateAt(0, 1, 29, 8, 30)), 60);

    const moved = createDateForGameDayOfYear(lastDayOfYearZero, 60);
    assert.deepEqual(calendarParts(moved), {
        day: 29,
        monthIndex: 1,
        year: 0,
    });
    assert.deepEqual(clockParts(moved), clockParts(lastDayOfYearZero));
});

test('createDateForGameDate moves the calendar date and keeps the clock time', () => {
    const currentDate = new Date(2026, 5, 21, 18, 45, 30, 250);
    const moved = createDateForGameDate(currentDate, new Date(2026, 11, 3));

    assert.deepEqual(calendarParts(moved), {
        day: 3,
        monthIndex: 11,
        year: 2026,
    });
    assert.deepEqual(clockParts(moved), clockParts(currentDate));

    // The source date is left untouched.
    assert.deepEqual(calendarParts(currentDate), {
        day: 21,
        monthIndex: 5,
        year: 2026,
    });
});

test('createDateForGameDate does not overflow short months', () => {
    const currentDate = new Date(2026, 4, 31, 7, 15);

    const february = createDateForGameDate(currentDate, new Date(2026, 1, 15));
    assert.deepEqual(calendarParts(february), {
        day: 15,
        monthIndex: 1,
        year: 2026,
    });

    // The last day of a 31 day month lands on the last day of a shorter one.
    const endOfFebruary = createDateForGameDate(
        currentDate,
        new Date(2026, 1, 28),
    );
    assert.deepEqual(calendarParts(endOfFebruary), {
        day: 28,
        monthIndex: 1,
        year: 2026,
    });
    assert.deepEqual(clockParts(endOfFebruary), clockParts(currentDate));
});

test('createDateForGameDate falls back predictably for unreadable dates', () => {
    const currentDate = new Date(2026, 9, 15, 10, 30);

    assert.deepEqual(
        createDateForGameDate(currentDate, new Date(Number.NaN)).getTime(),
        currentDate.getTime(),
    );
    assert.equal(
        Number.isNaN(
            createDateForGameDate(
                new Date(Number.NaN),
                new Date(2026, 9, 15),
            ).getTime(),
        ),
        true,
    );
});

test('createDateForGameDayOfYear resolves leap years without drifting a day', () => {
    const leapYearDate = new Date(2024, 0, 10, 21, 5);
    const leapDay = createDateForGameDayOfYear(leapYearDate, 60);
    assert.deepEqual(calendarParts(leapDay), {
        day: 29,
        monthIndex: 1,
        year: 2024,
    });
    assert.deepEqual(clockParts(leapDay), clockParts(leapYearDate));

    // The same day index is 1 March in a common year.
    const commonYearDate = new Date(2026, 0, 10, 21, 5);
    assert.deepEqual(
        calendarParts(createDateForGameDayOfYear(commonYearDate, 60)),
        {
            day: 1,
            monthIndex: 2,
            year: 2026,
        },
    );

    assert.deepEqual(
        calendarParts(createDateForGameDayOfYear(leapYearDate, 366)),
        {
            day: 31,
            monthIndex: 11,
            year: 2024,
        },
    );
    assert.deepEqual(
        calendarParts(createDateForGameDayOfYear(commonYearDate, 365)),
        { day: 31, monthIndex: 11, year: 2026 },
    );
});

test('createDateForGameDayOfYear wraps at the year boundary', () => {
    const currentDate = new Date(2026, 6, 4, 13, 20, 5, 100);

    // One day past the end of a common year returns to its first day.
    assert.deepEqual(
        calendarParts(createDateForGameDayOfYear(currentDate, 366)),
        {
            day: 1,
            monthIndex: 0,
            year: 2026,
        },
    );
    assert.deepEqual(
        calendarParts(createDateForGameDayOfYear(currentDate, 0)),
        {
            day: 31,
            monthIndex: 11,
            year: 2026,
        },
    );
    assert.deepEqual(
        calendarParts(createDateForGameDayOfYear(currentDate, -364)),
        { day: 1, monthIndex: 0, year: 2026 },
    );

    const wrapped = createDateForGameDayOfYear(currentDate, 731);
    assert.deepEqual(calendarParts(wrapped), {
        day: 1,
        monthIndex: 0,
        year: 2026,
    });
    assert.deepEqual(clockParts(wrapped), clockParts(currentDate));
});

test('createDateForGameDayOfYear accepts an explicit year and unreadable input', () => {
    const currentDate = new Date(2026, 6, 4, 13, 20);

    const leapDay = createDateForGameDayOfYear(currentDate, 60, 2024);
    assert.deepEqual(calendarParts(leapDay), {
        day: 29,
        monthIndex: 1,
        year: 2024,
    });

    assert.equal(
        createDateForGameDayOfYear(currentDate, Number.NaN).getTime(),
        currentDate.getTime(),
    );
    assert.equal(
        Number.isNaN(
            createDateForGameDayOfYear(new Date(Number.NaN), 60).getTime(),
        ),
        true,
    );
});

test('every day of a leap year and a common year round trips with its clock', () => {
    for (const year of [2024, 2026]) {
        const currentDate = new Date(year, 5, 21, 18, 45, 30, 250);
        const yearLength = getGameYearLengthDays(year);

        for (let dayOfYear = 1; dayOfYear <= yearLength; dayOfYear++) {
            const moved = createDateForGameDayOfYear(currentDate, dayOfYear);
            assert.equal(getGameDayOfYear(moved), dayOfYear);
            assert.equal(moved.getFullYear(), year);
            assert.deepEqual(clockParts(moved), clockParts(currentDate));
        }
    }
});

test('moving the scene date keeps the clock instead of the time of day', () => {
    const summerEvening = new Date(2026, 5, 21, 20, 30);
    const winterEvening = createDateForGameDate(
        summerEvening,
        new Date(2026, 11, 21),
    );

    // The time of day helper would drag the clock back to the summer sun.
    const draggedByTimeOfDay = createDateForGameTimeOfDay(winterEvening, 0.8);

    assert.equal(winterEvening.getHours(), 20);
    assert.equal(winterEvening.getMinutes(), 30);
    assert.notEqual(draggedByTimeOfDay.getHours(), winterEvening.getHours());
});
