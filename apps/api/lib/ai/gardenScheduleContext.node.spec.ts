import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeliverySlotsContext } from './gardenScheduleContext';

function slot(startAtIso: string, closesAtIso?: string) {
    const startAt = new Date(startAtIso);

    return {
        startAt,
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
        closesAt: closesAtIso ? new Date(closesAtIso) : null,
    };
}

test('buildDeliverySlotsContext maps slots to Zagreb local dates and windows', () => {
    const context = buildDeliverySlotsContext(
        [slot('2026-08-21T08:00:00.000Z')],
        new Date('2026-08-18T09:00:00.000Z'),
    );

    assert.deepStrictEqual(context, [
        {
            date: '2026-08-21',
            from: '10:00',
            to: '12:00',
            orderDeadline: '2026-08-19T08:00:00.000Z',
        },
    ]);
});

test('buildDeliverySlotsContext drops slots whose order deadline has passed', () => {
    const context = buildDeliverySlotsContext(
        [
            slot('2026-08-19T08:00:00.000Z'),
            slot('2026-08-24T08:00:00.000Z'),
            slot('2026-08-25T08:00:00.000Z', '2026-08-18T06:00:00.000Z'),
        ],
        new Date('2026-08-18T09:00:00.000Z'),
    );

    assert.deepStrictEqual(
        context.map((entry) => entry.date),
        ['2026-08-24'],
    );
});
