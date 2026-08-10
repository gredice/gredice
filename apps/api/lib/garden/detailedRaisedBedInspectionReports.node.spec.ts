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
                completedAt,
                completionNotes: '  Tlo je rahlo i dovoljno vlažno.  ',
                entityId: RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
                gardenId: 8,
                id: 42,
                raisedBedId: 17,
                status: 'pendingVerification',
            },
        ],
        raisedBeds: [{ id: 17, name: 'Gredica Sjever' }],
    });

    assert.deepEqual(reports, [
        {
            inspectedAt: completedAt.toISOString(),
            notes: 'Tlo je rahlo i dovoljno vlažno.',
            notificationId: 'notification-1',
            operationId: 42,
            raisedBedId: 17,
            raisedBedName: 'Gredica Sjever',
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
