import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DELIVERY_TIME_ZONE,
    formatDeliveryDate,
    formatDeliveryTime,
} from './deliverySlotFormatting.ts';

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
