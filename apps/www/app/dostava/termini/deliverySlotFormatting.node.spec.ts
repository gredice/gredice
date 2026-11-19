import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DELIVERY_TIME_ZONE,
    formatDeliveryDate,
    formatDeliveryTime,
} from './deliverySlotFormatting.ts';
import { findNextOpenSlot } from './nextOpenSlot.ts';

test('delivery dates render in the fixed Zagreb business timezone', () => {
    const summerSlot = '2026-08-18T08:00:00.000Z';
    const winterSlot = '2026-12-18T09:00:00.000Z';

    assert.equal(DELIVERY_TIME_ZONE, 'Europe/Zagreb');
    assert.equal(formatDeliveryTime(summerSlot), '10:00');
    assert.equal(formatDeliveryTime(winterSlot), '10:00');
    assert.equal(formatDeliveryDate(summerSlot, { weekday: 'short' }), 'uto');
    assert.equal(
        formatDeliveryDate(summerSlot, {
            day: 'numeric',
            month: 'short',
        }),
        '18. kol',
    );
});

test('next open slot skips closed, past and no longer bookable slots', () => {
    const now = new Date('2026-11-19T10:00:00.000Z').getTime();
    const slot = (
        id: number,
        type: 'delivery' | 'pickup',
        startAt: string,
        effectiveClosesAt: string,
        status = 'scheduled',
    ) => ({ id, type, startAt, effectiveClosesAt, status });
    const slots = [
        slot(
            1,
            'delivery',
            '2026-11-19T08:00:00.000Z',
            '2026-11-17T08:00:00.000Z',
        ),
        slot(
            2,
            'delivery',
            '2026-11-20T08:00:00.000Z',
            '2026-11-18T08:00:00.000Z',
        ),
        slot(
            3,
            'delivery',
            '2026-11-23T08:00:00.000Z',
            '2026-11-21T08:00:00.000Z',
            'closed',
        ),
        slot(
            4,
            'delivery',
            '2026-11-25T08:00:00.000Z',
            '2026-11-23T08:00:00.000Z',
        ),
        slot(
            5,
            'delivery',
            '2026-11-24T08:00:00.000Z',
            '2026-11-22T08:00:00.000Z',
        ),
        slot(
            6,
            'pickup',
            '2026-11-21T08:00:00.000Z',
            '2026-11-20T08:00:00.000Z',
        ),
    ];

    assert.equal(findNextOpenSlot(slots, 'delivery', now)?.id, 5);
    assert.equal(findNextOpenSlot(slots, 'pickup', now)?.id, 6);
    assert.equal(
        findNextOpenSlot(
            slots,
            'pickup',
            new Date('2026-11-22T00:00:00.000Z').getTime(),
        ),
        null,
    );
});
