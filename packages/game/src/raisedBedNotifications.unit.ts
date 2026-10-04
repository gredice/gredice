import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    detailedRaisedBedInspectionNotificationType,
    operationCanceledNotificationType,
    operationCompletedNotificationType,
    raisedBedFieldPhotoCompletedNotificationType,
    raisedBedPhotoCompletedNotificationType,
} from '@gredice/js/notifications';
import {
    type RaisedBedGardenNotification,
    raisedBedNotificationDisplayContent,
    selectRaisedBedGardenNotifications,
} from './raisedBedNotifications';

describe('raisedBedNotificationDisplayContent', () => {
    it('shows compact context without exposing markdown syntax', () => {
        assert.equal(
            raisedBedNotificationDisplayContent(
                'Danas je na **gredici Sjever** odrađena [rezidba](https://example.com).',
            ),
            'Danas je na gredici Sjever odrađena rezidba.',
        );
    });
});

const baseTimestamp = new Date('2026-08-11T08:00:00.000Z');

function notification(
    overrides: Partial<RaisedBedGardenNotification> = {},
): RaisedBedGardenNotification {
    return {
        id: 'notification-default',
        header: 'Nova obavijest za gredicu',
        content: 'U tvojoj gredici dogodila se promjena.',
        category: 'garden',
        type: 'general',
        priority: 'normal',
        gardenId: 8,
        raisedBedId: 17,
        imageUrl: null,
        iconUrl: null,
        linkUrl: '/?vrt=8&gredica=Gredica%20Sjever',
        metadata: {},
        readAt: null,
        timestamp: baseTimestamp,
        createdAt: baseTimestamp,
        ...overrides,
    };
}

describe('selectRaisedBedGardenNotifications', () => {
    it('classifies eligible raised-bed notifications into visual priority kinds', () => {
        const selected = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
            notifications: [
                notification({
                    id: 'raised-bed-photo',
                    imageUrl: 'https://cdn.example.com/raised-bed.webp',
                    raisedBedId: 11,
                    type: raisedBedPhotoCompletedNotificationType,
                }),
                notification({
                    id: 'field-photo',
                    imageUrl: 'https://cdn.example.com/field.webp',
                    raisedBedId: 12,
                    type: raisedBedFieldPhotoCompletedNotificationType,
                }),
                notification({
                    id: 'image-visual',
                    imageUrl: 'https://cdn.example.com/raised-bed.webp',
                    raisedBedId: 13,
                }),
                notification({
                    id: 'icon-visual',
                    iconUrl: 'https://cdn.example.com/operation.webp',
                    raisedBedId: 14,
                }),
                notification({
                    id: 'plant-update',
                    raisedBedId: 15,
                    type: 'plant_status_updated',
                }),
                notification({
                    id: 'field-target',
                    metadata: { positionIndex: 2 },
                    raisedBedId: 16,
                    type: 'general',
                }),
                notification({
                    id: 'legacy-field-image',
                    imageUrl: 'https://cdn.example.com/plant.webp',
                    linkUrl: 'https://vrt.gredice.com?gredica=Istok&polje=3',
                    raisedBedId: 17,
                }),
                notification({
                    id: 'legacy-field-text',
                    linkUrl: '/?gredica=Zapad&polje=2',
                    raisedBedId: 18,
                }),
                notification({
                    id: 'photo-type-without-image',
                    raisedBedId: 19,
                    type: raisedBedPhotoCompletedNotificationType,
                }),
                notification({
                    id: 'field-operation-without-image',
                    linkUrl: '/?gredica=Sjever&polje=3',
                    metadata: { raisedBedFieldId: 42 },
                    raisedBedId: 20,
                    type: operationCompletedNotificationType,
                }),
                notification({
                    id: 'field-operation-canceled',
                    linkUrl: '/?gredica=Sjever&polje=3',
                    metadata: { raisedBedFieldId: 42 },
                    raisedBedId: 21,
                    type: operationCanceledNotificationType,
                }),
            ],
        });

        assert.deepEqual(
            selected.map(({ id, kind }) => ({ id, kind })),
            [
                { id: 'raised-bed-photo', kind: 'raisedBedPhoto' },
                { id: 'field-photo', kind: 'raisedBedFieldPhoto' },
                { id: 'image-visual', kind: 'visual' },
                { id: 'icon-visual', kind: 'visual' },
                { id: 'plant-update', kind: 'fieldOrPlantUpdate' },
                { id: 'field-target', kind: 'fieldOrPlantUpdate' },
                {
                    id: 'legacy-field-image',
                    kind: 'raisedBedFieldPhoto',
                },
                {
                    id: 'legacy-field-text',
                    kind: 'fieldOrPlantUpdate',
                },
                { id: 'photo-type-without-image', kind: 'text' },
                { id: 'field-operation-without-image', kind: 'text' },
                { id: 'field-operation-canceled', kind: 'text' },
            ],
        );
    });

    it('ranks notification kind before stored priority', () => {
        const selected = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17],
            notifications: [
                notification({
                    id: 'critical-text',
                    priority: 'critical',
                    timestamp: new Date('2026-08-11T10:00:00.000Z'),
                }),
                notification({
                    id: 'critical-field-update',
                    metadata: { raisedBedFieldId: 90 },
                    priority: 'critical',
                    timestamp: new Date('2026-08-11T09:00:00.000Z'),
                }),
                notification({
                    id: 'critical-visual',
                    imageUrl: 'https://cdn.example.com/other.webp',
                    priority: 'critical',
                }),
                notification({
                    id: 'critical-field-photo',
                    imageUrl: 'https://cdn.example.com/field.webp',
                    priority: 'critical',
                    type: raisedBedFieldPhotoCompletedNotificationType,
                }),
                notification({
                    id: 'low-raised-bed-photo',
                    imageUrl: 'https://cdn.example.com/raised-bed.webp',
                    priority: 'low',
                    timestamp: new Date('2026-08-01T08:00:00.000Z'),
                    type: raisedBedPhotoCompletedNotificationType,
                }),
            ],
        });

        assert.equal(selected[0]?.id, 'low-raised-bed-photo');
        assert.equal(selected[0]?.kind, 'raisedBedPhoto');
    });

    it('ranks a legacy field image above generic media and requires a positive polje target', () => {
        const selected = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17, 18, 19],
            notifications: [
                notification({
                    id: 'generic-critical-image',
                    imageUrl: 'https://cdn.example.com/generic.webp',
                    priority: 'critical',
                    raisedBedId: 17,
                }),
                notification({
                    id: 'legacy-field-image',
                    imageUrl: 'https://cdn.example.com/field.webp',
                    linkUrl: '/?gredica=Sjever&polje=1',
                    priority: 'low',
                    raisedBedId: 17,
                }),
                notification({
                    id: 'zero-field-image',
                    imageUrl: 'https://cdn.example.com/zero.webp',
                    linkUrl: '/?gredica=Jug&polje=0',
                    raisedBedId: 18,
                }),
                notification({
                    id: 'invalid-field-text',
                    linkUrl: '/?gredica=Zapad&polje=biljka',
                    raisedBedId: 19,
                }),
            ],
        });

        assert.deepEqual(
            selected.map(({ id, kind }) => ({ id, kind })),
            [
                {
                    id: 'legacy-field-image',
                    kind: 'raisedBedFieldPhoto',
                },
                { id: 'zero-field-image', kind: 'visual' },
                { id: 'invalid-field-text', kind: 'text' },
            ],
        );
    });

    it('uses stored priority, timestamps, creation time, and ID as deterministic tie-breakers', () => {
        const firstSelection = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17],
            notifications: [
                notification({
                    id: 'new-normal',
                    priority: 'normal',
                    timestamp: new Date('2026-08-11T12:00:00.000Z'),
                }),
                notification({
                    id: 'older-high',
                    priority: 'high',
                    timestamp: new Date('2026-08-10T12:00:00.000Z'),
                }),
            ],
        });
        assert.equal(firstSelection[0]?.id, 'older-high');

        const timestampSelection = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17],
            notifications: [
                notification({
                    id: 'older',
                    timestamp: new Date('2026-08-11T08:00:00.000Z'),
                }),
                notification({
                    id: 'newer',
                    timestamp: new Date('2026-08-11T09:00:00.000Z'),
                }),
            ],
        });
        assert.equal(timestampSelection[0]?.id, 'newer');

        const creationSelection = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17],
            notifications: [
                notification({
                    id: 'created-first',
                    createdAt: new Date('2026-08-11T08:00:00.000Z'),
                }),
                notification({
                    id: 'created-last',
                    createdAt: new Date('2026-08-11T09:00:00.000Z'),
                }),
            ],
        });
        assert.equal(creationSelection[0]?.id, 'created-last');

        const idSelection = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17],
            notifications: [
                notification({ id: 'notification-a' }),
                notification({ id: 'notification-z' }),
            ],
        });
        assert.equal(idSelection[0]?.id, 'notification-z');
    });

    it('excludes read, cross-garden, missing-bed, inspection, and unrelated text notifications', () => {
        const selected = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17],
            notifications: [
                notification({
                    id: 'read',
                    readAt: new Date('2026-08-11T09:00:00.000Z'),
                }),
                notification({ id: 'cross-garden', gardenId: 9 }),
                notification({ id: 'missing-bed', raisedBedId: 99 }),
                notification({
                    id: 'inspection',
                    type: detailedRaisedBedInspectionNotificationType,
                }),
                notification({
                    id: 'checkout-text',
                    category: 'checkout_fulfillment',
                    priority: 'critical',
                    type: 'checkout_planting_target_conflict',
                }),
                notification({
                    id: 'legacy-general',
                    category: 'general',
                    type: 'general',
                }),
            ],
        });

        assert.deepEqual(
            selected.map(({ id }) => id),
            ['legacy-general'],
        );
    });

    it('allows visual media from another category without admitting its text-only sibling', () => {
        const selected = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17, 18],
            notifications: [
                notification({
                    id: 'campaign-text',
                    category: 'campaign',
                    raisedBedId: 17,
                }),
                notification({
                    id: 'campaign-image',
                    category: 'campaign',
                    imageUrl: 'https://cdn.example.com/campaign.webp',
                    raisedBedId: 18,
                }),
            ],
        });

        assert.deepEqual(
            selected.map(({ id, kind }) => ({ id, kind })),
            [{ id: 'campaign-image', kind: 'visual' }],
        );
    });

    it('promotes the next notification after the selected row is read', () => {
        const raisedBedPhoto = notification({
            id: 'raised-bed-photo',
            imageUrl: 'https://cdn.example.com/raised-bed.webp',
            priority: 'low',
            type: raisedBedPhotoCompletedNotificationType,
        });
        const operation = notification({
            id: 'operation',
            priority: 'high',
            type: operationCompletedNotificationType,
        });
        const notifications = [operation, raisedBedPhoto];

        const initialSelection = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17],
            notifications,
        });
        assert.equal(initialSelection[0]?.id, 'raised-bed-photo');

        const promotedSelection = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [17],
            notifications: notifications.map((item) =>
                item.id === raisedBedPhoto.id
                    ? {
                          ...item,
                          readAt: new Date('2026-08-11T10:00:00.000Z'),
                      }
                    : item,
            ),
        });
        assert.equal(promotedSelection[0]?.id, 'operation');
        assert.equal(promotedSelection[0]?.kind, 'text');
    });

    it('returns exactly one candidate per logical bed in raised-bed order', () => {
        const selected = selectRaisedBedGardenNotifications({
            gardenId: 8,
            raisedBedIds: [18, 17, 18],
            notifications: [
                notification({
                    id: 'bed-17-operation',
                    raisedBedId: 17,
                }),
                notification({
                    id: 'bed-17-image',
                    imageUrl: 'https://cdn.example.com/17.webp',
                    raisedBedId: 17,
                }),
                notification({
                    id: 'bed-18-older',
                    raisedBedId: 18,
                    timestamp: new Date('2026-08-10T08:00:00.000Z'),
                }),
                notification({
                    id: 'bed-18-newer',
                    raisedBedId: 18,
                    timestamp: new Date('2026-08-11T08:00:00.000Z'),
                }),
            ],
        });

        assert.deepEqual(
            selected.map(({ id, raisedBedId }) => ({ id, raisedBedId })),
            [
                { id: 'bed-18-newer', raisedBedId: 18 },
                { id: 'bed-17-image', raisedBedId: 17 },
            ],
        );
    });
});
