import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeRaisedBedGardenNotification } from './raisedBedNotifications';

test('serializes only the private Garden raised-bed notification contract', () => {
    const serialized = serializeRaisedBedGardenNotification({
        category: 'garden',
        content: 'Nova fotografija gredice.',
        createdAt: new Date('2026-08-11T12:00:01.000Z'),
        gardenId: 8,
        header: 'Nova fotografija',
        iconUrl: null,
        id: 'notification-1',
        imageUrl: 'https://cdn.example.com/raised-bed.jpg',
        linkUrl: 'https://vrt.gredice.test?gredica=Sjever',
        metadata: { operationId: 42 },
        priority: 'high',
        raisedBedId: 17,
        readAt: null,
        timestamp: new Date('2026-08-11T12:00:00.000Z'),
        type: 'raised_bed_photo_completed',
    });

    assert.deepEqual(serialized, {
        id: 'notification-1',
        header: 'Nova fotografija',
        content: 'Nova fotografija gredice.',
        iconUrl: null,
        imageUrl: 'https://cdn.example.com/raised-bed.jpg',
        linkUrl: 'https://vrt.gredice.test?gredica=Sjever',
        category: 'garden',
        type: 'raised_bed_photo_completed',
        priority: 'high',
        metadata: { operationId: 42 },
        gardenId: 8,
        raisedBedId: 17,
        readAt: null,
        timestamp: '2026-08-11T12:00:00.000Z',
        createdAt: '2026-08-11T12:00:01.000Z',
    });
});
