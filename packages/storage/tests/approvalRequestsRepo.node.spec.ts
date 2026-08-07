import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    approveApprovalRequest,
    approvePlantStatusApprovalRequest,
    createAccount,
    createEvent,
    createFarm,
    createPlantStatusApprovalRequest,
    getAllEvents,
    getApprovalRequest,
    getApprovalRequests,
    getPendingApprovalRequestsCount,
    getRaisedBedFieldsWithEvents,
    knownEvents,
    knownEventTypes,
    rejectApprovalRequest,
    upsertRaisedBedField,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createPlantStatusApprovalFixture() {
    createTestDb();
    const farmId = await createFarm({
        name: `Approval farm ${randomUUID()}`,
        latitude: 45.8,
        longitude: 15.9,
    });
    const accountId = await createAccount();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, `approval-${randomUUID()}`);
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    const positionIndex = 0;
    const plantSortId = 404;
    const aggregateId = `${raisedBedId.toString()}|${positionIndex.toString()}`;
    await upsertRaisedBedField({ raisedBedId, positionIndex });
    const plantPlaceEvent = await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: plantSortId.toString(),
            scheduledDate: '2026-05-24T08:00:00.000Z',
        }),
    );
    const plannedEvent = await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'planned',
        }),
    );
    const [field] = await getRaisedBedFieldsWithEvents(raisedBedId);
    assert.ok(field);
    const request = await createPlantStatusApprovalRequest({
        accountId,
        currentStatus: 'planned',
        effectiveAt: new Date('2026-05-25T10:00:00.000Z'),
        gardenId,
        plantCycleEventId: plantPlaceEvent.id,
        plantCycleVersionEventId: plannedEvent.id,
        plantSortId,
        positionIndex,
        raisedBedFieldId: field.id,
        raisedBedId,
        requestedBy: `farmer-${randomUUID()}`,
        requestedStatus: 'sowed',
    });

    return {
        aggregateId,
        plantSortId,
        positionIndex,
        raisedBedId,
        request,
    };
}

test('plant status approval requests stay pending until reviewed', async () => {
    createTestDb();

    const request = await createPlantStatusApprovalRequest({
        raisedBedId: 101,
        positionIndex: 3,
        plantCycleEventId: 301,
        plantCycleVersionEventId: 302,
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
        plantCycleEventId: 301,
        plantCycleVersionEventId: 302,
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
                plantCycleEventId: 301,
                plantCycleVersionEventId: 302,
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
        plantCycleEventId: 401,
        plantCycleVersionEventId: 402,
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

test('plant status approval rolls back an injected review failure and retries exactly once', async () => {
    const fixture = await createPlantStatusApprovalFixture();
    const input = {
        requestId: fixture.request.id,
        reviewedBy: `admin-${randomUUID()}`,
    };

    await assert.rejects(
        approvePlantStatusApprovalRequest(input, {
            appendApprovalEvent: async () => {
                throw new Error('injected approval append failure');
            },
        }),
        /injected approval append failure/u,
    );
    const [fieldAfterFailure] = await getRaisedBedFieldsWithEvents(
        fixture.raisedBedId,
    );
    assert.equal(fieldAfterFailure?.plantStatus, 'planned');
    assert.equal(
        (await getApprovalRequest(fixture.request.id))?.status,
        'pending',
    );

    const approved = await approvePlantStatusApprovalRequest(input);
    const repeated = await approvePlantStatusApprovalRequest(input);
    assert.equal(approved.status, 'approved');
    assert.equal(repeated.status, 'approved');
    const [fieldAfterRetry] = await getRaisedBedFieldsWithEvents(
        fixture.raisedBedId,
    );
    assert.equal(fieldAfterRetry?.plantStatus, 'sowed');
    assert.equal(
        (
            await getAllEvents(knownEventTypes.approvalRequests.approve, [
                fixture.request.id,
            ])
        ).length,
        1,
    );
    assert.equal(
        (
            await getAllEvents(knownEventTypes.raisedBedFields.plantUpdate, [
                fixture.aggregateId,
            ])
        ).length,
        2,
    );
});

test('concurrent plant status approvals create one plant mutation and one review', async () => {
    const fixture = await createPlantStatusApprovalFixture();
    const results = await Promise.all(
        Array.from({ length: 8 }, () =>
            approvePlantStatusApprovalRequest({
                requestId: fixture.request.id,
                reviewedBy: 'admin-concurrent-approval',
            }),
        ),
    );

    assert.equal(
        results.every((result) => result.status === 'approved'),
        true,
    );
    assert.equal(
        (
            await getAllEvents(knownEventTypes.approvalRequests.approve, [
                fixture.request.id,
            ])
        ).length,
        1,
    );
    assert.equal(
        (
            await getAllEvents(knownEventTypes.raisedBedFields.plantUpdate, [
                fixture.aggregateId,
            ])
        ).length,
        2,
    );
});

test('plant status approval rejects a stale task version without reviewing the request', async () => {
    const fixture = await createPlantStatusApprovalFixture();
    await createEvent(
        knownEvents.raisedBedFields.plantScheduleV1(fixture.aggregateId, {
            scheduledDate: '2026-05-27T08:00:00.000Z',
        }),
    );

    await assert.rejects(
        approvePlantStatusApprovalRequest({
            requestId: fixture.request.id,
            reviewedBy: 'admin-stale-approval',
        }),
        /Biljka se promijenila/u,
    );
    assert.equal(
        (await getApprovalRequest(fixture.request.id))?.status,
        'pending',
    );
    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.equal(field?.plantStatus, 'planned');
});

test('concurrent approval and rejection append exactly one terminal review', async () => {
    const fixture = await createPlantStatusApprovalFixture();
    const results = await Promise.allSettled([
        approvePlantStatusApprovalRequest({
            requestId: fixture.request.id,
            reviewedBy: 'admin-approve-race',
        }),
        rejectApprovalRequest(fixture.request.id, 'admin-reject-race'),
    ]);
    assert.equal(
        results.some((result) => result.status === 'fulfilled'),
        true,
    );

    const [approveEvents, rejectEvents] = await Promise.all([
        getAllEvents(knownEventTypes.approvalRequests.approve, [
            fixture.request.id,
        ]),
        getAllEvents(knownEventTypes.approvalRequests.reject, [
            fixture.request.id,
        ]),
    ]);
    assert.equal(approveEvents.length + rejectEvents.length, 1);
    const reviewedRequest = await getApprovalRequest(fixture.request.id);
    assert.ok(reviewedRequest);
    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.equal(
        field?.plantStatus,
        reviewedRequest.status === 'approved' ? 'sowed' : 'planned',
    );
});
