import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    autoCloseUpcomingSlots,
    createPickupLocation,
    createTimeSlot,
    getTimeSlot,
    TimeSlotStatuses,
} from '@gredice/storage';
import { createTestDb } from './testDb';

async function createTestLocation() {
    return await createPickupLocation({
        name: `Auto close test ${randomUUID()}`,
        street1: 'Testna 1',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
        isActive: true,
    });
}

async function createScheduledSlot({
    locationId,
    startAt,
    closesAt = null,
}: {
    locationId: number;
    startAt: Date;
    closesAt?: Date | null;
}) {
    return await createTimeSlot({
        locationId,
        type: 'delivery',
        startAt,
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
        closesAt,
        status: TimeSlotStatuses.SCHEDULED,
    });
}

test('autoCloseUpcomingSlots closes slots inside the default 48-hour window', async () => {
    createTestDb();

    const referenceDate = new Date('2026-07-01T08:00:00.000Z');
    const locationId = await createTestLocation();
    const insideWindowSlotId = await createScheduledSlot({
        locationId,
        startAt: new Date('2026-07-03T07:00:00.000Z'),
    });
    const outsideWindowSlotId = await createScheduledSlot({
        locationId,
        startAt: new Date('2026-07-03T09:00:00.000Z'),
    });

    await autoCloseUpcomingSlots(referenceDate);

    const insideWindowSlot = await getTimeSlot(insideWindowSlotId);
    const outsideWindowSlot = await getTimeSlot(outsideWindowSlotId);

    assert.equal(insideWindowSlot?.status, TimeSlotStatuses.CLOSED);
    assert.equal(outsideWindowSlot?.status, TimeSlotStatuses.SCHEDULED);
});

test('autoCloseUpcomingSlots honors explicit close dates', async () => {
    createTestDb();

    const referenceDate = new Date('2026-07-01T08:00:00.000Z');
    const locationId = await createTestLocation();
    const keptOpenSlotId = await createScheduledSlot({
        locationId,
        startAt: new Date('2026-07-02T08:00:00.000Z'),
        closesAt: new Date('2026-07-01T10:00:00.000Z'),
    });
    const customClosedSlotId = await createScheduledSlot({
        locationId,
        startAt: new Date('2026-07-04T08:00:00.000Z'),
        closesAt: new Date('2026-07-01T07:00:00.000Z'),
    });

    await autoCloseUpcomingSlots(referenceDate);

    const keptOpenSlot = await getTimeSlot(keptOpenSlotId);
    const customClosedSlot = await getTimeSlot(customClosedSlotId);

    assert.equal(keptOpenSlot?.status, TimeSlotStatuses.SCHEDULED);
    assert.equal(customClosedSlot?.status, TimeSlotStatuses.CLOSED);
});
