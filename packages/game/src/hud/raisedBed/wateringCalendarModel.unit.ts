import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildWateringCalendarMonths,
    type WateringCalendarEntry,
} from './wateringCalendarModel';

function markedDays(entries: WateringCalendarEntry[]) {
    return buildWateringCalendarMonths(
        entries,
        new Date('2026-06-18T12:00:00.000Z'),
    ).flatMap((month) =>
        month.weeks.flatMap((week) =>
            week.filter((day) => day?.entries.length),
        ),
    );
}

test('watering calendar keeps empty dates visible between marked dates', () => {
    const months = buildWateringCalendarMonths([
        {
            id: 'first',
            date: '2026-05-03T08:00:00.000Z',
            label: 'Lagano zalijevanje',
            source: 'completed',
            weight: 15,
        },
        {
            id: 'second',
            date: '2026-06-12T08:00:00.000Z',
            label: 'Dubinsko zalijevanje',
            source: 'scheduled',
            weight: 60,
        },
    ]);

    assert.deepEqual(
        months.map((month) => month.key),
        ['2026-05', '2026-06'],
    );
    const mayDays = months[0].weeks.flatMap((week) =>
        week.filter((day) => day?.key.startsWith('2026-05')),
    );
    assert.equal(mayDays.length, 31);
    assert.equal(mayDays[0]?.entries.length, 0);
    assert.equal(
        mayDays.find((day) => day?.key === '2026-05-03')?.entries.length,
        1,
    );
});

test('watering calendar scales marker size by total watering weight', () => {
    const days = markedDays([
        {
            id: 'small',
            date: '2026-06-01T08:00:00.000Z',
            label: 'Kratko zalijevanje',
            source: 'completed',
            weight: 10,
        },
        {
            id: 'large',
            date: '2026-06-02T08:00:00.000Z',
            label: 'Veliko zalijevanje',
            source: 'completed',
            weight: 90,
        },
    ]);

    const small = days.find((day) => day?.key === '2026-06-01');
    const large = days.find((day) => day?.key === '2026-06-02');

    assert.ok(small);
    assert.ok(large);
    assert.ok(small.markerSize < large.markerSize);
});

test('watering calendar prioritizes preview and cart markers for shared dates', () => {
    const days = markedDays([
        {
            id: 'completed',
            date: '2026-06-10T08:00:00.000Z',
            label: 'Gotovo zalijevanje',
            source: 'completed',
            weight: 30,
        },
        {
            id: 'cart',
            date: '2026-06-11T08:00:00.000Z',
            label: 'Zalijevanje u košari',
            source: 'cart',
            weight: 30,
        },
        {
            id: 'preview',
            date: '2026-06-11T08:00:00.000Z',
            label: 'Novi termin',
            source: 'preview',
            weight: 30,
        },
    ]);

    assert.equal(
        days.find((day) => day?.key === '2026-06-10')?.tone,
        'completed',
    );
    assert.equal(
        days.find((day) => day?.key === '2026-06-11')?.tone,
        'preview',
    );
});

test('watering calendar renders future completed entries as scheduled', () => {
    const days = markedDays([
        {
            id: 'past-completed',
            date: '2026-06-10T08:00:00.000Z',
            label: 'Gotovo zalijevanje',
            source: 'completed',
            weight: 30,
        },
        {
            id: 'future-confirmed',
            date: '2026-06-22T08:00:00.000Z',
            label: 'Potvrđeno buduće zalijevanje',
            source: 'completed',
            weight: 30,
        },
    ]);

    assert.equal(
        days.find((day) => day?.key === '2026-06-10')?.tone,
        'completed',
    );
    assert.equal(
        days.find((day) => day?.key === '2026-06-22')?.tone,
        'scheduled',
    );
});
