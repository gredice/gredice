import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    approvePlantStatusApprovalRequest,
    completeSelectedRaisedBedPlantingTask,
    createSelectedPlantStatusApprovalRequest,
    getAllEvents,
    getApprovalRequest,
    getRaisedBedFieldsWithEvents,
    getRaisedBedPlanting,
    knownEventTypes,
    rejectApprovalRequest,
    updateSelectedRaisedBedPlantingLifecycleStatus,
} from '@gredice/storage';
import { createSelectedTaskFixture } from './helpers/selectedPlantingFixture';

async function fixture() {
    const f = await createSelectedTaskFixture({ multiField: true });
    const sowed = await completeSelectedRaisedBedPlantingTask({
        ...f.task.identity,
        commandId: randomUUID(),
        actor: { role: 'admin', userId: f.adminId },
    });
    const input = {
        ...sowed.task.identity,
        raisedBedId: f.raisedBedId,
        actor: { role: 'farmer' as const, userId: f.farmerId },
        requestedStatus: 'sprouted',
    };
    return { ...f, input };
}

test('selected planting request stays pending and approval changes only its lifecycle once', async () => {
    const f = await fixture();
    const before = await getRaisedBedPlanting(f.plantingId);
    const fieldsBefore = await getRaisedBedFieldsWithEvents(f.raisedBedId);
    const request = await createSelectedPlantStatusApprovalRequest(f.input);
    assert.equal(request.target.kind, 'raisedBedPlanting.plantStatus');
    assert.equal(request.status, 'pending');
    assert.equal(
        (await getRaisedBedPlanting(f.plantingId))?.lifecycleStatus,
        'sowed',
    );
    const duplicate = await createSelectedPlantStatusApprovalRequest(f.input);
    assert.equal(duplicate.id, request.id);
    await assert.rejects(
        createSelectedPlantStatusApprovalRequest({
            ...f.input,
            requestedStatus: 'notSprouted',
        }),
        /Već postoji zahtjev/,
    );
    const approved = await approvePlantStatusApprovalRequest({
        requestId: request.id,
        reviewedBy: f.adminId,
    });
    assert.equal(approved.status, 'approved');
    await approvePlantStatusApprovalRequest({
        requestId: request.id,
        reviewedBy: f.adminId,
    });
    const after = await getRaisedBedPlanting(f.plantingId);
    assert.equal(after?.lifecycleStatus, 'sprouted');
    assert.deepEqual(after?.memberships, before?.memberships);
    assert.equal(after?.plantCount, before?.plantCount);
    assert.equal(
        after?.selectedSeedingDistanceCm,
        before?.selectedSeedingDistanceCm,
    );
    assert.deepEqual(
        after?.selectedTask?.purchase,
        before?.selectedTask?.purchase,
    );
    assert.deepEqual(
        await getRaisedBedFieldsWithEvents(f.raisedBedId),
        fieldsBefore,
    );
    assert.equal(
        (
            await getAllEvents(
                knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
                [f.aggregateId],
            )
        ).length,
        1,
    );
    assert.equal(
        (
            await getAllEvents(knownEventTypes.approvalRequests.approve, [
                request.id,
            ])
        ).length,
        1,
    );
});

test('selected approval is atomic, rolls back review failures and supports concurrent retries', async () => {
    const f = await fixture();
    const request = await createSelectedPlantStatusApprovalRequest(f.input);
    const input = { requestId: request.id, reviewedBy: f.adminId };
    await assert.rejects(
        approvePlantStatusApprovalRequest(input, {
            appendApprovalEvent: async () => {
                throw new Error('injected review failure');
            },
        }),
        /injected review failure/,
    );
    assert.equal(
        (await getRaisedBedPlanting(f.plantingId))?.lifecycleStatus,
        'sowed',
    );
    assert.equal((await getApprovalRequest(request.id))?.status, 'pending');
    const results = await Promise.all(
        Array.from({ length: 4 }, () =>
            approvePlantStatusApprovalRequest(input),
        ),
    );
    assert.ok(results.every((r) => r.status === 'approved'));
    assert.equal(
        (
            await getAllEvents(
                knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
                [f.aggregateId],
            )
        ).length,
        1,
    );
});

test('selected requests reject unauthorized actors, wrong bed, stale identity and invalid transitions', async () => {
    const f = await fixture();
    await assert.rejects(
        createSelectedPlantStatusApprovalRequest({
            ...f.input,
            actor: { role: 'farmer', userId: f.outsiderId },
        }),
    );
    await assert.rejects(
        createSelectedPlantStatusApprovalRequest({
            ...f.input,
            raisedBedId: f.raisedBedId + 9999,
        }),
    );
    await assert.rejects(
        createSelectedPlantStatusApprovalRequest({
            ...f.input,
            expectedPlantSortId: f.plantSortId + 1,
        }),
    );
    await assert.rejects(
        createSelectedPlantStatusApprovalRequest({
            ...f.input,
            expectedLifecycleVersionEventId:
                f.task.identity.expectedLifecycleVersionEventId,
        }),
    );
    for (const requestedStatus of [
        'ready',
        'sowed',
        'planned',
        'pendingVerification',
        'removed',
        'invalid',
    ]) {
        await assert.rejects(
            createSelectedPlantStatusApprovalRequest({
                ...f.input,
                requestedStatus,
            }),
        );
    }
    const request = await createSelectedPlantStatusApprovalRequest(f.input);
    await assert.rejects(
        approvePlantStatusApprovalRequest({
            requestId: request.id,
            reviewedBy: f.farmerId,
        }),
    );
    assert.equal((await getApprovalRequest(request.id))?.status, 'pending');
});

test('stale selected approval stays pending and does not overwrite a later lifecycle event', async () => {
    const f = await fixture();
    const request = await createSelectedPlantStatusApprovalRequest(f.input);
    await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...f.input,
        commandId: randomUUID(),
        actor: { role: 'admin', userId: f.adminId },
        status: 'notSprouted',
    });
    await assert.rejects(
        approvePlantStatusApprovalRequest({
            requestId: request.id,
            reviewedBy: f.adminId,
        }),
    );
    assert.equal((await getApprovalRequest(request.id))?.status, 'pending');
    assert.equal(
        (await getRaisedBedPlanting(f.plantingId))?.lifecycleStatus,
        'notSprouted',
    );
});

test('rejection leaves selected lifecycle untouched and cannot later be approved', async () => {
    const f = await fixture();
    const request = await createSelectedPlantStatusApprovalRequest(f.input);
    await rejectApprovalRequest(request.id, f.adminId);
    await assert.rejects(
        approvePlantStatusApprovalRequest({
            requestId: request.id,
            reviewedBy: f.adminId,
        }),
        /odbijen/,
    );
    assert.equal(
        (await getRaisedBedPlanting(f.plantingId))?.lifecycleStatus,
        'sowed',
    );
});
