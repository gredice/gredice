import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    autoCloseUpcomingSlots,
    createPickupLocation,
    createTimeSlot,
    getTimeSlot,
    getTimeSlots,
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

test('getTimeSlots can include scheduled and closed slots without archived slots', async () => {
    createTestDb();

    const locationId = await createTestLocation();
    const startsAt = [
        new Date('2026-08-03T08:00:00.000Z'),
        new Date('2026-08-03T10:00:00.000Z'),
        new Date('2026-08-03T12:00:00.000Z'),
    ];
    const statuses = [
        TimeSlotStatuses.SCHEDULED,
        TimeSlotStatuses.CLOSED,
        TimeSlotStatuses.ARCHIVED,
    ];

    const slotIds = await Promise.all(
        startsAt.map((startAt, index) =>
            createTimeSlot({
                locationId,
                type: 'delivery',
                startAt,
                endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
                status: statuses[index],
            }),
        ),
    );

    const visibleSlots = await getTimeSlots({
        locationId,
        fromDate: new Date('2026-08-03T00:00:00.000Z'),
        toDate: new Date('2026-08-04T00:00:00.000Z'),
        status: [TimeSlotStatuses.SCHEDULED, TimeSlotStatuses.CLOSED],
    });

    assert.deepEqual(
        visibleSlots.map((slot) => slot.id),
        slotIds.slice(0, 2),
    );
});
