import assert from 'node:assert/strict';
import test from 'node:test';
import { RAISED_BED_DETAILED_INSPECTION_OPERATION_ID } from '@gredice/storage';
import {
    buildDetailedRaisedBedInspectionReports,
    detailedInspectionOperationId,
} from './detailedRaisedBedInspectionReports';

test('reads only positive safe operation IDs from notification metadata', () => {
    assert.equal(detailedInspectionOperationId({ operationId: 12 }), 12);
    assert.equal(detailedInspectionOperationId({ operationId: '12' }), null);
    assert.equal(detailedInspectionOperationId({ operationId: -1 }), null);
});

test('hydrates unread inspection notifications from current operation notes', () => {
    const completedAt = new Date('2026-08-10T08:30:00.000Z');
    const reports = buildDetailedRaisedBedInspectionReports({
        accountId: 'account-1',
        gardenId: 8,
        notifications: [
            {
                id: 'notification-1',
                metadata: { operationId: 42 },
                timestamp: new Date('2026-08-10T08:31:00.000Z'),
            },
        ],
        operations: [
            {
                accountId: 'account-1',
                assignedUser: {
                    avatarUrl: 'https://cdn.example.com/farmer.jpg',
                    displayName: '  Ana Farmer  ',
                    userName: 'ana',
                },
                completedAt,
                completionNotes: '  Tlo je rahlo i dovoljno vlažno.  ',
                entityId: RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
                gardenId: 8,
                id: 42,
                raisedBedId: 17,
                status: 'pendingVerification',
            },
        ],
        raisedBeds: [
            {
                id: 17,
                latestPhotoOperation: {
                    imageUrls: [
                        'https://cdn.example.com/latest.jpg',
                        'https://cdn.example.com/second.jpg',
                    ],
                },
                name: 'Gredica Sjever',
                physicalId: 'S-17',
            },
        ],
    });

    assert.deepEqual(reports, [
        {
            assignedFarmer: {
                avatarUrl: 'https://cdn.example.com/farmer.jpg',
                displayName: 'Ana Farmer',
            },
            inspectedAt: completedAt.toISOString(),
            notes: 'Tlo je rahlo i dovoljno vlažno.',
            notificationId: 'notification-1',
            operationId: 42,
            raisedBedId: 17,
            raisedBedImageUrl: 'https://cdn.example.com/latest.jpg',
            raisedBedName: 'Gredica Sjever',
            raisedBedPhysicalId: 'S-17',
        },
    ]);
});

test('rejects reports outside the authenticated account and garden', () => {
    const reports = buildDetailedRaisedBedInspectionReports({
        accountId: 'account-1',
        gardenId: 8,
        notifications: [
            {
                id: 'notification-1',
                metadata: { operationId: 42 },
                timestamp: new Date('2026-08-10T08:31:00.000Z'),
            },
        ],
        operations: [
            {
                accountId: 'account-2',
                entityId: RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
                gardenId: 9,
                id: 42,
                raisedBedId: 17,
                status: 'completed',
            },
        ],
        raisedBeds: [{ id: 17, name: 'Tuđa gredica' }],
    });

    assert.deepEqual(reports, []);
});

test('falls back to the assigned username and omits unavailable raised bed media', () => {
    const reports = buildDetailedRaisedBedInspectionReports({
        accountId: 'account-1',
        gardenId: 8,
        notifications: [
            {
                id: 'notification-1',
                metadata: { operationId: 42 },
                timestamp: new Date('2026-08-10T08:31:00.000Z'),
            },
        ],
        operations: [
            {
                accountId: 'account-1',
                assignedUser: {
                    avatarUrl: null,
                    displayName: null,
                    userName: 'ivan',
                },
                entityId: RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
                gardenId: 8,
                id: 42,
                raisedBedId: 17,
                status: 'completed',
            },
        ],
        raisedBeds: [{ id: 17, name: 'Gredica Jug' }],
    });

    assert.equal(reports[0]?.assignedFarmer?.displayName, 'ivan');
    assert.equal(reports[0]?.raisedBedImageUrl, null);
    assert.equal(reports[0]?.raisedBedPhysicalId, null);
});
