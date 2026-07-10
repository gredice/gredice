import assert from 'node:assert/strict';
import test from 'node:test';
import {
    addCalendarDays,
    calendarDateKeyToUtcDate,
    getTimeZoneDateKey,
    getTimeZoneDayRange,
    isCalendarDateKey,
} from '../src/helpers/timezoneUtils';

const ZAGREB_TIME_ZONE = 'Europe/Zagreb';

test('validates calendar date keys', () => {
    assert.equal(isCalendarDateKey('2026-07-10'), true);
    assert.equal(isCalendarDateKey('2026-02-29'), false);
    assert.equal(isCalendarDateKey('2026-7-10'), false);
});

test('adds calendar days without depending on the runtime time zone', () => {
    assert.equal(addCalendarDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addCalendarDays('2026-03-01', -1), '2026-02-28');
    assert.equal(
        calendarDateKeyToUtcDate('2026-07-10').toISOString(),
        '2026-07-10T00:00:00.000Z',
    );
});

test('uses the Zagreb calendar date across the summer UTC rollover', () => {
    assert.equal(
        getTimeZoneDateKey(
            new Date('2026-07-10T21:59:59.999Z'),
            ZAGREB_TIME_ZONE,
        ),
        '2026-07-10',
    );
    assert.equal(
        getTimeZoneDateKey(
            new Date('2026-07-10T22:00:00.000Z'),
            ZAGREB_TIME_ZONE,
        ),
        '2026-07-11',
    );
});

test('builds Zagreb day ranges that exclude the following local day', () => {
    const julyTenth = getTimeZoneDayRange('2026-07-10', ZAGREB_TIME_ZONE);
    const julyEleventh = getTimeZoneDayRange('2026-07-11', ZAGREB_TIME_ZONE);

    assert.equal(julyTenth.from.toISOString(), '2026-07-09T22:00:00.000Z');
    assert.equal(julyTenth.to.toISOString(), '2026-07-10T21:59:59.999Z');
    assert.equal(julyEleventh.from.toISOString(), '2026-07-10T22:00:00.000Z');
    assert.equal(
        new Date('2026-07-10T22:00:00.000Z').getTime() <=
            julyTenth.to.getTime(),
        false,
    );
    assert.equal(
        new Date('2026-07-10T22:00:00.000Z').getTime() >=
            julyEleventh.from.getTime(),
        true,
    );
});

test('builds DST-aware Zagreb day ranges', () => {
    const springForwardDay = getTimeZoneDayRange(
        '2026-03-29',
        ZAGREB_TIME_ZONE,
    );

    assert.equal(
        springForwardDay.to.getTime() - springForwardDay.from.getTime() + 1,
        23 * 60 * 60 * 1000,
    );
});
