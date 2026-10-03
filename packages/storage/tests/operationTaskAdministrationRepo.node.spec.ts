import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    administerOperationTask,
    assignUserToFarm,
    attributeDefinitions,
    createAccount,
    createAttributeDefinition,
    createEntity,
    createEvent,
    createFarm,
    createOperation,
    getAllEvents,
    getAllOperations,
    getFarmAcceptedOperationsByScheduleRange,
    getOperationById,
    getOperationsPage,
    knownEvents,
    knownEventTypes,
    storage,
    updateOperationCompletionEvidence,
    upsertAttributeValue,
    upsertEntityType,
    users,
} from '@gredice/storage';
import { and, asc, eq } from 'drizzle-orm';
import {
    type OperationTaskAdminValues,
    operationTaskStatuses,
} from '../src/operationTaskAdministration';
import { createTestDb } from './testDb';

async function fixture() {
    createTestDb();
    const adminId = randomUUID();
    const farmerId = randomUUID();
    await storage()
        .insert(users)
        .values([
            { id: adminId, userName: `admin-${adminId}`, role: 'admin' },
            { id: farmerId, userName: `farmer-${farmerId}`, role: 'farmer' },
        ]);
    const farmId = await createFarm({
        name: 'Admin correction farm',
        latitude: 45,
        longitude: 16,
    });
    await assignUserToFarm(farmId, farmerId);
    const accountId = await createAccount();
    const operationId = await createOperation({
        entityId: 1,
        entityTypeName: 'operation',
        farmId,
        accountId,
    });
    const current = await getOperationById(operationId);
    const values: OperationTaskAdminValues = {
        entityId: 1,
        status: 'new',
        isAccepted: false,
        assignedUserIds: [],
        timestamp: current.timestamp.toISOString(),
        createdAt: current.createdAt.toISOString(),
        assignedAt: null,
        scheduledDate: null,
        scheduledAt: null,
        completedAt: null,
        verifiedAt: null,
        blockedAt: null,
        canceledAt: null,
        requestNote: '',
        blockReasonCode: '',
        blockReasonLabel: '',
        blockNote: '',
        error: '',
        errorCode: '',
        cancelReason: '',
    };
    return { operationId, adminId, farmerId, farmId, accountId, values };
}

for (const status of operationTaskStatuses) {
    test(`admin can edit a task in ${status} state and reopen it`, async () => {
        const f = await fixture();
        const date = '2026-09-29T08:15:30.000Z';
        const values = {
            ...f.values,
            status,
            isAccepted: true,
            assignedUserIds: [f.farmerId],
            assignedAt: date,
            scheduledDate: date,
            scheduledAt: date,
            completedAt: ['completed', 'pendingVerification'].includes(status)
                ? date
                : null,
            verifiedAt: status === 'completed' ? date : null,
            blockedAt: status === 'blocked' ? date : null,
            canceledAt: status === 'canceled' ? date : null,
            requestNote: 'Ispravljena napomena',
        };
        const event = await administerOperationTask({
            ...f,
            values,
            updatedBy: f.adminId,
            expectedTaskVersionEventId: 0,
        });
        let current = await getOperationById(f.operationId);
        assert.equal(current.status, status);
        assert.equal(current.isAccepted, true);
        assert.deepEqual(current.assignedUserIds, [f.farmerId]);
        assert.equal(current.scheduledDate?.toISOString(), date);
        assert.equal(current.requestNote, 'Ispravljena napomena');
        const page = await getOperationsPage({
            accountId: f.accountId,
            includeCompleted: true,
        });
        assert.ok(
            (await getAllOperations({ status })).some(
                (item) => item.id === f.operationId,
            ),
        );
        assert.ok(page.items.some((item) => item.id === f.operationId));
        const schedule = await getFarmAcceptedOperationsByScheduleRange({
            farmId: f.farmId,
            from: new Date('2026-09-29T00:00:00Z'),
            to: new Date('2026-09-29T23:59:59Z'),
        });
        assert.ok(schedule.some((item) => item.id === f.operationId));
        if (values.completedAt) {
            const completed = await getAllOperations({
                completedFrom: new Date('2026-09-29T00:00:00Z'),
                completedTo: new Date('2026-09-29T23:59:59Z'),
            });
            assert.ok(completed.some((item) => item.id === f.operationId));
        }
        await administerOperationTask({
            ...f,
            values: { ...f.values, timestamp: date, createdAt: date },
            updatedBy: f.adminId,
            expectedTaskVersionEventId: event.id,
        });
        current = await getOperationById(f.operationId);
        assert.equal(current.status, 'new');
        assert.equal(current.isAccepted, false);
        assert.equal(current.completedAt, undefined);
        assert.equal(current.scheduledDate, undefined);
        assert.equal(current.timestamp.toISOString(), date);
        assert.deepEqual(current.assignedUserIds, []);
        const history = await getAllEvents(
            [knownEventTypes.operations.adminUpdate],
            [f.operationId.toString()],
        );
        assert.equal(history.length, 2);
    });
}

test('admin corrections reject farmers, stale versions, invalid dates, and users from another farm atomically', async () => {
    const f = await fixture();
    await assert.rejects(
        administerOperationTask({
            ...f,
            updatedBy: f.farmerId,
            expectedTaskVersionEventId: 0,
        }),
        { code: 'not_authorized' },
    );
    await assert.rejects(
        administerOperationTask({
            ...f,
            updatedBy: f.adminId,
            expectedTaskVersionEventId: 1,
        }),
        { code: 'task_changed' },
    );
    await assert.rejects(
        administerOperationTask({
            ...f,
            values: { ...f.values, completedAt: 'invalid' },
            updatedBy: f.adminId,
            expectedTaskVersionEventId: 0,
        }),
    );
    await assert.rejects(
        administerOperationTask({
            ...f,
            values: { ...f.values, assignedUserIds: [f.adminId] },
            updatedBy: f.adminId,
            expectedTaskVersionEventId: 0,
        }),
        { code: 'not_authorized' },
    );
    assert.equal((await getOperationById(f.operationId)).taskVersionEventId, 0);
});

test('administration can update notes and photos in every state while preserving state and audit dates', async () => {
    const f = await fixture();
    for (const status of operationTaskStatuses) {
        let current = await getOperationById(f.operationId);
        const date = '2026-09-29T08:15:30.000Z';
        await administerOperationTask({
            ...f,
            updatedBy: f.adminId,
            expectedTaskVersionEventId: current.taskVersionEventId,
            values: {
                ...f.values,
                status,
                completedAt: ['completed', 'pendingVerification'].includes(
                    status,
                )
                    ? date
                    : null,
                verifiedAt: status === 'completed' ? date : null,
            },
        });
        current = await getOperationById(f.operationId);
        await updateOperationCompletionEvidence({
            administration: true,
            operationId: f.operationId,
            updatedBy: f.adminId,
            expectedTaskVersionEventId: current.taskVersionEventId,
            notes: `Bilješka ${status}`,
            imageUrls: [`https://cdn.gredice.com/${status}.jpg`],
        });
        const updated = await getOperationById(f.operationId);
        assert.equal(updated.status, status);
        assert.equal(
            updated.verifiedAt?.toISOString(),
            current.verifiedAt?.toISOString(),
        );
        assert.equal(updated.completionNotes, `Bilješka ${status}`);
        assert.deepEqual(updated.imageUrls, [
            `https://cdn.gredice.com/${status}.jpg`,
        ]);
    }
});

test('a date-only correction keeps original completion/verification identity and filters by the corrected date', async () => {
    const f = await fixture();
    const complete = await createEvent(
        knownEvents.operations.completedV1(f.operationId.toString(), {
            completedBy: f.farmerId,
            images: ['https://cdn.gredice.com/original.jpg'],
            notes: 'Izvorni zapis',
        }),
    );
    const verify = await createEvent(
        knownEvents.operations.verifiedV1(f.operationId.toString(), {
            verifiedBy: f.adminId,
        }),
    );
    const current = await getOperationById(f.operationId);
    assert.ok(current.completedAt);
    const corrected = '2025-02-14T08:00:00.000Z';
    await administerOperationTask({
        ...f,
        updatedBy: f.adminId,
        expectedTaskVersionEventId: current.taskVersionEventId,
        values: {
            ...f.values,
            status: 'completed',
            completedAt: corrected,
            verifiedAt: current.verifiedAt?.toISOString(),
        },
    });
    const updated = await getOperationById(f.operationId);
    assert.equal(updated.completionEventId, complete.id);
    assert.equal(updated.verificationEventId, verify.id);
    assert.equal(updated.completedBy, f.farmerId);
    assert.equal(updated.verifiedBy, f.adminId);
    assert.equal(updated.completionNotes, 'Izvorni zapis');
    assert.deepEqual(updated.imageUrls, [
        'https://cdn.gredice.com/original.jpg',
    ]);
    const priorRange = await getAllOperations({
        completedFrom: new Date(current.completedAt.getTime() - 1000),
        completedTo: new Date(current.completedAt.getTime() + 1000),
    });
    assert.ok(!priorRange.some((item) => item.id === f.operationId));
    const correctedRange = await getAllOperations({
        completedFrom: new Date('2025-02-14T00:00:00Z'),
        completedTo: new Date('2025-02-14T23:59:59Z'),
    });
    assert.ok(correctedRange.some((item) => item.id === f.operationId));
});

test('a verified task can change definition while incompatible target scopes are rejected', async () => {
    const f = await fixture();
    await upsertEntityType({ name: 'operation', label: 'Radnja' });
    const existingDefinition =
        await storage().query.attributeDefinitions.findFirst({
            columns: { id: true },
            where: and(
                eq(attributeDefinitions.entityTypeName, 'operation'),
                eq(attributeDefinitions.category, 'attributes'),
                eq(attributeDefinitions.name, 'application'),
                eq(attributeDefinitions.isDeleted, false),
            ),
            orderBy: asc(attributeDefinitions.id),
        });
    const applicationId =
        existingDefinition?.id ??
        (await createAttributeDefinition({
            entityTypeName: 'operation',
            category: 'attributes',
            name: 'application',
            label: 'Primjena',
            dataType: 'text',
        }));
    await createEntity('operation');
    const replacementId = await createEntity('operation');
    assert.notEqual(replacementId, f.values.entityId);
    const invalidId = await createEntity('operation');
    await upsertAttributeValue({
        entityId: replacementId,
        entityTypeName: 'operation',
        attributeDefinitionId: applicationId,
        value: 'farm',
    });
    await upsertAttributeValue({
        entityId: invalidId,
        entityTypeName: 'operation',
        attributeDefinitionId: applicationId,
        value: 'plant',
    });
    const date = '2026-09-29T08:15:30.000Z';
    const verified = {
        ...f.values,
        status: 'completed',
        completedAt: date,
        verifiedAt: date,
    };
    await administerOperationTask({
        ...f,
        updatedBy: f.adminId,
        expectedTaskVersionEventId: 0,
        values: verified,
    });
    let current = await getOperationById(f.operationId);
    await administerOperationTask({
        ...f,
        updatedBy: f.adminId,
        expectedTaskVersionEventId: current.taskVersionEventId,
        values: { ...verified, entityId: replacementId },
    });
    current = await getOperationById(f.operationId);
    assert.equal(current.entityId, replacementId);
    assert.equal(current.status, 'completed');
    await assert.rejects(
        administerOperationTask({
            ...f,
            updatedBy: f.adminId,
            expectedTaskVersionEventId: current.taskVersionEventId,
            values: { ...verified, entityId: invalidId },
        }),
        { code: 'incompatible_scope' },
    );
    assert.equal(
        (await getOperationById(f.operationId)).taskVersionEventId,
        current.taskVersionEventId,
    );
});
