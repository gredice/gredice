import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildRaisedBedPhotographyScheduleContext,
    getNextRaisedBedPhotographyDates,
} from './raisedBedPhotographySchedule';

test('getNextRaisedBedPhotographyDates returns the upcoming Tuesdays and Fridays', () => {
    // 2026-08-19 is a Wednesday in Zagreb.
    assert.deepStrictEqual(
        getNextRaisedBedPhotographyDates(new Date('2026-08-19T08:00:00.000Z')),
        ['2026-08-21', '2026-08-25', '2026-08-28'],
    );
});

test('getNextRaisedBedPhotographyDates keeps the reference day when it is a photography day', () => {
    // 2026-08-21 is a Friday in Zagreb.
    assert.deepStrictEqual(
        getNextRaisedBedPhotographyDates(
            new Date('2026-08-21T18:00:00.000Z'),
            2,
        ),
        ['2026-08-21', '2026-08-25'],
    );
});

test('getNextRaisedBedPhotographyDates uses the Zagreb local day', () => {
    // 2026-08-20T22:30Z is already Friday 2026-08-21 in Zagreb.
    assert.deepStrictEqual(
        getNextRaisedBedPhotographyDates(
            new Date('2026-08-20T22:30:00.000Z'),
            1,
        ),
        ['2026-08-21'],
    );
});

test('buildRaisedBedPhotographyScheduleContext describes the twice weekly cadence', () => {
    const context = buildRaisedBedPhotographyScheduleContext(
        new Date('2026-08-19T08:00:00.000Z'),
    );

    assert.strictEqual(context.timesPerWeek, 2);
    assert.deepStrictEqual(context.weekdays, ['utorak', 'petak']);
    assert.deepStrictEqual(context.upcomingPhotographyDates, [
        '2026-08-21',
        '2026-08-25',
        '2026-08-28',
    ]);
});
