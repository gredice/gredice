import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeliverySlotAvailable } from './deliverySlotAvailability';

const referenceDate = new Date('2026-07-17T10:00:00.000Z');

test('keeps an explicitly open same-day slot available before it starts', () => {
    assert.equal(
        isDeliverySlotAvailable(
            {
                effectiveClosesAt: '2026-07-17T11:00:00.000Z',
                startAt: '2026-07-17T12:00:00.000Z',
                status: 'scheduled',
            },
            referenceDate,
        ),
        true,
    );
});

test('disables closed, expired, and already-started slots', () => {
    const futureSlot = {
        effectiveClosesAt: '2026-07-17T11:00:00.000Z',
        startAt: '2026-07-17T12:00:00.000Z',
        status: 'scheduled',
    };

    assert.equal(
        isDeliverySlotAvailable(
            { ...futureSlot, status: 'closed' },
            referenceDate,
        ),
        false,
    );
    assert.equal(
        isDeliverySlotAvailable(
            {
                ...futureSlot,
                effectiveClosesAt: '2026-07-17T09:00:00.000Z',
            },
            referenceDate,
        ),
        false,
    );
    assert.equal(
        isDeliverySlotAvailable(
            { ...futureSlot, startAt: '2026-07-17T09:00:00.000Z' },
            referenceDate,
        ),
        false,
    );
});
