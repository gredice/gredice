import assert from 'node:assert/strict';
import test from 'node:test';
import {
    approveApprovalRequest,
    createPlantStatusApprovalRequest,
    getApprovalRequest,
    getApprovalRequests,
    getPendingApprovalRequestsCount,
    rejectApprovalRequest,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('plant status approval requests stay pending until reviewed', async () => {
    createTestDb();

    const request = await createPlantStatusApprovalRequest({
        raisedBedId: 101,
        positionIndex: 3,
        raisedBedFieldId: 303,
        accountId: 'account-approval-1',
        gardenId: 202,
        plantSortId: 404,
        currentStatus: 'sowed',
        requestedStatus: 'sprouted',
        requestedBy: 'farmer-approval-1',
        effectiveAt: new Date('2026-05-25T10:00:00.000Z'),
    });

    assert.equal(request.status, 'pending');
    assert.equal(request.target.kind, 'raisedBedField.plantStatus');
    assert.equal(request.target.requestedStatus, 'sprouted');

    const duplicate = await createPlantStatusApprovalRequest({
        raisedBedId: 101,
        positionIndex: 3,
        currentStatus: 'sowed',
        requestedStatus: 'sprouted',
        requestedBy: 'farmer-approval-1',
    });
    assert.equal(duplicate.id, request.id);

    await assert.rejects(
        () =>
            createPlantStatusApprovalRequest({
                raisedBedId: 101,
                positionIndex: 3,
                currentStatus: 'sowed',
                requestedStatus: 'ready',
                requestedBy: 'farmer-approval-1',
            }),
        /Već postoji zahtjev/u,
    );

    const pendingCountBeforeReview = await getPendingApprovalRequestsCount();
    assert.ok(pendingCountBeforeReview >= 1);

    const approved = await approveApprovalRequest(
        request.id,
        'admin-approval-1',
    );
    assert.equal(approved.status, 'approved');
    assert.equal(approved.reviewedBy, 'admin-approval-1');

    const stored = await getApprovalRequest(request.id);
    assert.equal(stored?.status, 'approved');

    const pendingForTarget = await getApprovalRequests({
        status: 'pending',
        kind: 'raisedBedField.plantStatus',
    });
    assert.equal(
        pendingForTarget.some((candidate) => candidate.id === request.id),
        false,
    );
});

test('plant status approval requests can be rejected', async () => {
    createTestDb();

    const request = await createPlantStatusApprovalRequest({
        raisedBedId: 111,
        positionIndex: 4,
        currentStatus: 'sprouted',
        requestedStatus: 'ready',
        requestedBy: 'farmer-approval-2',
    });

    const rejected = await rejectApprovalRequest(
        request.id,
        'admin-approval-2',
        'Needs another photo',
    );
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.reviewedBy, 'admin-approval-2');
    assert.equal(rejected.reviewNote, 'Needs another photo');
});
