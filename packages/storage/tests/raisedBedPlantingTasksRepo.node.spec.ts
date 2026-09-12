import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    assignSelectedRaisedBedPlantingTask,
    assignUserToFarm,
    attributeDefinitions,
    blockSelectedRaisedBedPlantingTask,
    cancelSelectedRaisedBedPlantingTaskForOwner,
    completeSelectedRaisedBedPlantingTask,
    correctSelectedRaisedBedPlantingSort,
    createAccount,
    createAttributeDefinition,
    createEntity,
    createFarm,
    createOperation,
    createOrGetHarvestTraceLink,
    createOrGetSelectedPlantingHarvestTraceLink,
    createRaisedBedPlanting,
    createSelectedPlantingOperation,
    earnSunflowersOnce,
    ensureSelectedRaisedBedPlantingSowedNotification,
    entities,
    getAllEvents,
    getFarmUserPrintableHarvestTraceLinkIds,
    getOperationById,
    getPublicHarvestTraceByToken,
    getRaisedBed,
    getRaisedBedFieldsWithEvents,
    getRaisedBedPlanting,
    getRaisedBedPlantingByEventAggregateId,
    getSelectedRaisedBedPlantingTask,
    getSelectedRaisedBedPlantingTaskForActor,
    getSelectedRaisedBedPlantingTaskForOwner,
    getSunflowers,
    knownEventTypes,
    notifications,
    OperationTargetConflictError,
    raisedBeds,
    rescheduleSelectedRaisedBedPlantingTask,
    rescheduleSelectedRaisedBedPlantingTaskForOwner,
    ScheduleTaskSubmissionError,
    type SelectedRaisedBedPlantingTaskReadModel,
    storage,
    submitOperationTaskCompletion,
    transplantSelectedRaisedBedPlanting,
    updateEntity,
    updateSelectedRaisedBedPlantingLifecycleStatus,
    upsertAttributeValue,
    upsertEntityType,
    upsertRaisedBedField,
    users,
    verifyOperationTaskCompletion,
    verifySelectedRaisedBedPlantingTask,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createTestUser(role: 'admin' | 'farmer') {
    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `${role}-${userId}@example.com`,
            role,
        });
    return userId;
}

async function createSelectedTaskFixture({
    multiField = false,
    sunflowerAmount = 1250,
    sowingLocation = 'direct',
    secondPhysicalBlock = false,
}: {
    multiField?: boolean;
    sunflowerAmount?: number;
    sowingLocation?: 'direct' | 'greenhouse';
    secondPhysicalBlock?: boolean;
} = {}) {
    createTestDb();
    const [adminId, farmerId, otherFarmerId, outsiderId, ownerUserId] =
        await Promise.all([
            createTestUser('admin'),
            createTestUser('farmer'),
            createTestUser('farmer'),
            createTestUser('farmer'),
            createTestUser('farmer'),
        ]);
    const farmId = await createFarm({
        name: `Selected task farm ${randomUUID()}`,
        latitude: 45.8,
        longitude: 15.9,
    });
    await Promise.all([
        assignUserToFarm(farmId, farmerId),
        assignUserToFarm(farmId, otherFarmerId),
    ]);
    const accountId = await createAccount();
    await storage().insert(accountUsers).values({
        accountId,
        userId: ownerUserId,
    });
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(
        gardenId,
        `selected-task-${randomUUID()}`,
    );
    const firstBlockId = secondPhysicalBlock
        ? await createTestBlock(gardenId, `first-block-${randomUUID()}`)
        : null;
    const firstBedId = firstBlockId
        ? await createTestRaisedBed(gardenId, accountId, firstBlockId)
        : null;
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    if (firstBedId) {
        const physicalId = `shared-${randomUUID()}`;
        await storage()
            .update(raisedBeds)
            .set({ physicalId })
            .where(eq(raisedBeds.id, firstBedId));
        await storage()
            .update(raisedBeds)
            .set({ physicalId })
            .where(eq(raisedBeds.id, raisedBedId));
    }
    const positions = multiField ? [17, 16, 14, 13] : [0];
    await Promise.all(
        positions.map((positionIndex) =>
            upsertRaisedBedField({ raisedBedId, positionIndex }),
        ),
    );
    const fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    const fieldsByPosition = new Map(
        fields.map((field) => [field.positionIndex, field]),
    );
    await upsertEntityType({ name: 'plantSort', label: 'Plant sort' });
    const plantSortId = await createEntity('plantSort');
    const aggregateId = `raised-bed-planting:selected:task:${randomUUID()}`;
    const membershipPositions = multiField ? [17, 16, 14, 13] : [0];
    const plantingInput = {
        raisedBedId,
        plantSortId,
        eventAggregateId: aggregateId,
        anchorPositionIndex: multiField ? 17 : 0,
        minSeedingDistanceCm: 15,
        optimalSeedingDistanceCm: 30,
        maxSeedingDistanceCm: 60,
        selectedSeedingDistanceCm: multiField ? 60 : 15,
        plantsPerAxis: multiField ? 1 : 2,
        plantCount: multiField ? 1 : 4,
        layoutKey: multiField
            ? 'v1:fields:2x2:plants:1x1'
            : 'v1:fields:1x1:plants:2x2',
        spanRows: multiField ? 2 : 1,
        spanColumns: multiField ? 2 : 1,
        layoutVersion: 1,
        configurationSource: 'selected',
        lifecycleStarted: {
            commandId: randomUUID(),
            scheduledDate: new Date(Date.now() + 86_400_000).toISOString(),
            sowingLocation,
            purchase: {
                cartItemId: Math.floor(Math.random() * 1_000_000) + 1,
                currency: 'sunflower',
                sunflowerAmount,
            },
            startedBy: ownerUserId,
        },
        memberships: membershipPositions.map((positionIndex, index) => {
            const field = fieldsByPosition.get(positionIndex);
            assert.ok(field);
            return {
                raisedBedFieldId: field.id,
                relativeRow: multiField ? Math.floor(index / 2) : 0,
                relativeColumn: multiField ? index % 2 : 0,
                isAnchor: index === 0,
            };
        }),
    } satisfies Parameters<typeof createRaisedBedPlanting>[0];
    const planting = await createRaisedBedPlanting(plantingInput);
    assert.ok(planting.planting.selectedTask);
    return {
        accountId,
        plantingInput,
        adminId,
        aggregateId,
        farmerId,
        farmId,
        otherFarmerId,
        outsiderId,
        owner: { accountId, userId: ownerUserId },
        plantingId: planting.planting.id,
        plantSortId,
        raisedBedId,
        task: planting.planting.selectedTask,
    };
}

function commandIdentity(
    task: SelectedRaisedBedPlantingTaskReadModel,
    commandId = randomUUID(),
) {
    return { ...task.identity, commandId };
}

async function expectSubmissionError(
    promise: Promise<unknown>,
    code: ScheduleTaskSubmissionError['code'],
) {
    await assert.rejects(promise, (error: unknown) => {
        assert.ok(error instanceof ScheduleTaskSubmissionError);
        assert.equal(error.code, code);
        return true;
    });
}

test('creates a task-visible lifecycle event atomically with selected planting', async () => {
    const fixture = await createSelectedTaskFixture();
    const [task, planting, plantingByAggregateId, events] = await Promise.all([
        getSelectedRaisedBedPlantingTask(fixture.plantingId),
        getRaisedBedPlanting(fixture.plantingId),
        getRaisedBedPlantingByEventAggregateId(fixture.aggregateId),
        getAllEvents(
            [knownEventTypes.raisedBedPlantings.lifecycleStarted],
            [fixture.aggregateId],
        ),
    ]);

    assert.ok(task && planting && plantingByAggregateId);
    assert.equal(plantingByAggregateId.id, planting.id);
    assert.equal(events.length, 1);
    assert.equal(task.identity.expectedLifecycleVersionEventId, events[0]?.id);
    assert.equal(planting.lifecycleVersionEventId, events[0]?.id);
    assert.equal(planting.lifecycleStatus, 'planned');
    assert.equal(
        planting.selectedTask?.purchase?.cartItemId,
        task.purchase?.cartItemId,
    );
});

test('supports assign, block, explicit unblock, Farm completion, and Admin verification', async () => {
    const fixture = await createSelectedTaskFixture();
    const assigned = await assignSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        assignedUserIds: [fixture.farmerId],
    });
    assert.deepStrictEqual(assigned.task.assignedUserIds, [fixture.farmerId]);

    const blocked = await blockSelectedRaisedBedPlantingTask({
        ...commandIdentity(assigned.task),
        actor: { userId: fixture.farmerId, role: 'farmer' },
        reasonCode: 'missing_materials',
    });
    assert.equal(blocked.task.status, 'blocked');
    await expectSubmissionError(
        completeSelectedRaisedBedPlantingTask({
            ...commandIdentity(blocked.task),
            actor: { userId: fixture.farmerId, role: 'farmer' },
        }),
        'invalid_status',
    );

    const rescheduled = await rescheduleSelectedRaisedBedPlantingTaskForOwner({
        ...commandIdentity(blocked.task),
        owner: fixture.owner,
        scheduledDate: new Date(Date.now() + 172_800_000).toISOString(),
        sowingLocation: 'greenhouse',
    });
    assert.equal(rescheduled.task.status, 'planned');
    assert.equal(rescheduled.task.block, null);

    const completed = await completeSelectedRaisedBedPlantingTask({
        ...commandIdentity(rescheduled.task),
        actor: { userId: fixture.farmerId, role: 'farmer' },
        imageUrls: ['https://example.com/evidence.webp'],
        notes: 'Posijano.',
    });
    assert.equal(completed.task.status, 'pendingVerification');
    assert.equal(completed.lifecycleStatus, 'pendingVerification');

    const verified = await verifySelectedRaisedBedPlantingTask({
        ...commandIdentity(completed.task),
        actor: { userId: fixture.adminId, role: 'admin' },
    });
    assert.equal(verified.task.status, 'completed');
    assert.equal(verified.lifecycleStatus, 'sowed');
});

test('notifies one account once for an Admin-completed multi-field planting', async (t) => {
    const fixture = await createSelectedTaskFixture({ multiField: true });
    const warnings: unknown[][] = [];
    t.mock.method(console, 'warn', (...args: unknown[]) => {
        warnings.push(args);
    });
    const completed = await completeSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor: { userId: fixture.adminId, role: 'admin' },
    });

    const first = await ensureSelectedRaisedBedPlantingSowedNotification({
        eventId: completed.eventId,
        plantingId: completed.plantingId,
    });
    const replay = await ensureSelectedRaisedBedPlantingSowedNotification({
        eventId: completed.eventId,
        plantingId: completed.plantingId,
    });
    const [raisedBed, accountNotifications] = await Promise.all([
        getRaisedBed(fixture.raisedBedId),
        storage()
            .select()
            .from(notifications)
            .where(eq(notifications.accountId, fixture.accountId)),
    ]);

    assert.ok(raisedBed);
    assert.equal(first.created, true);
    assert.equal(replay.created, false);
    assert.equal(replay.notificationId, first.notificationId);
    assert.equal(accountNotifications.length, 1);
    const [notification] = accountNotifications;
    assert.ok(notification);
    assert.equal(notification.id, first.notificationId);
    assert.equal(notification.accountId, fixture.accountId);
    assert.equal(notification.gardenId, raisedBed.gardenId);
    assert.equal(notification.raisedBedId, fixture.raisedBedId);
    assert.equal(notification.userId, null);
    assert.equal(notification.header, 'Biljka je posijana!');
    assert.equal(
        notification.content,
        `U gredici **${raisedBed.name}** na poljima **14, 15, 17 i 18** posijana je odabrana biljka.`,
    );
    assert.equal(
        notification.timestamp.toISOString(),
        completed.occurredAt.toISOString(),
    );
    assert.deepEqual(notification.metadata, {});
    assert.ok(notification.linkUrl);
    const notificationUrl = new URL(notification.linkUrl);
    assert.equal(notificationUrl.searchParams.get('gredica'), raisedBed.name);
    assert.equal(notificationUrl.searchParams.has('polje'), false);
    assert.equal(notification.content.includes(fixture.adminId), false);
    assert.equal(notification.content.includes(fixture.farmerId), false);

    const missingMetadataWarning = warnings.find(
        ([message]) =>
            message ===
            'Selected planting sowing notification is missing plant sort metadata.',
    );
    assert.deepEqual(missingMetadataWarning, [
        'Selected planting sowing notification is missing plant sort metadata.',
        {
            eventId: completed.eventId,
            plantingId: fixture.plantingId,
            plantSortId: fixture.plantSortId,
        },
    ]);
    assert.equal(
        JSON.stringify(missingMetadataWarning).includes(fixture.adminId),
        false,
    );
    assert.equal(
        JSON.stringify(missingMetadataWarning).includes(fixture.farmerId),
        false,
    );
});

test('notifies only after Admin verifies a Farm-completed planting', async (t) => {
    const fixture = await createSelectedTaskFixture();
    t.mock.method(console, 'warn', () => undefined);
    const completed = await completeSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    assert.equal(completed.lifecycleStatus, 'pendingVerification');
    await assert.rejects(
        ensureSelectedRaisedBedPlantingSowedNotification({
            eventId: completed.eventId,
            plantingId: completed.plantingId,
        }),
        /requires a canonical sowed event/,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(notifications)
                .where(eq(notifications.accountId, fixture.accountId))
        ).length,
        0,
    );

    const verified = await verifySelectedRaisedBedPlantingTask({
        ...commandIdentity(completed.task),
        actor: { userId: fixture.adminId, role: 'admin' },
    });
    const notification = await ensureSelectedRaisedBedPlantingSowedNotification(
        {
            eventId: verified.eventId,
            plantingId: verified.plantingId,
        },
    );

    assert.equal(notification.created, true);
    assert.equal(
        (
            await storage()
                .select()
                .from(notifications)
                .where(eq(notifications.accountId, fixture.accountId))
        ).length,
        1,
    );
});

test('keeps stopped crops collision-active until explicit removal', async () => {
    const fixture = await createSelectedTaskFixture();
    const completed = await completeSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor: { userId: fixture.adminId, role: 'admin' },
    });
    const failed = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(completed.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        status: 'notSprouted',
    });
    assert.equal(failed.isActive, true);
    assert.ok(failed.lifecycleStoppedAt);
    assert.equal(
        (await getRaisedBedPlanting(fixture.plantingId))?.isActive,
        true,
    );

    const corrected = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(failed.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        status: 'sprouted',
    });
    assert.equal(corrected.isActive, true);
    assert.equal(corrected.lifecycleStoppedAt, null);

    const died = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(corrected.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        status: 'died',
    });
    const removed = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(died.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        status: 'removed',
    });
    assert.equal(removed.isActive, false);
    assert.equal(
        (await getRaisedBedPlanting(fixture.plantingId))?.isActive,
        false,
    );
    await expectSubmissionError(
        updateSelectedRaisedBedPlantingLifecycleStatus({
            ...commandIdentity(removed.task),
            actor: { userId: fixture.adminId, role: 'admin' },
            status: 'sprouted',
        }),
        'invalid_status',
    );
});

test('replays before optimistic version checks and rejects command reuse', async () => {
    const fixture = await createSelectedTaskFixture();
    const commandId = randomUUID();
    const input = {
        ...commandIdentity(fixture.task, commandId),
        actor: { userId: fixture.adminId, role: 'admin' as const },
        scheduledDate: new Date(Date.now() + 172_800_000).toISOString(),
        sowingLocation: 'direct' as const,
    };
    const first = await rescheduleSelectedRaisedBedPlantingTask(input);
    const replay = await rescheduleSelectedRaisedBedPlantingTask(input);

    assert.equal(first.created, true);
    assert.equal(replay.created, false);
    assert.equal(replay.eventId, first.eventId);
    await expectSubmissionError(
        rescheduleSelectedRaisedBedPlantingTask({
            ...input,
            scheduledDate: new Date(Date.now() + 259_200_000).toISOString(),
        }),
        'submission_conflict',
    );
    await expectSubmissionError(
        rescheduleSelectedRaisedBedPlantingTask({
            ...input,
            commandId: randomUUID(),
        }),
        'task_changed',
    );
});

test('claims same-status lifecycle command IDs with a durable version event', async () => {
    const fixture = await createSelectedTaskFixture();
    const completed = await completeSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor: { userId: fixture.adminId, role: 'admin' },
    });
    const commandId = randomUUID();
    const input = {
        ...commandIdentity(completed.task, commandId),
        actor: { userId: fixture.adminId, role: 'admin' as const },
        status: 'sowed' as const,
    };
    const first = await updateSelectedRaisedBedPlantingLifecycleStatus(input);
    const replay = await updateSelectedRaisedBedPlantingLifecycleStatus(input);

    assert.equal(first.created, true);
    assert.notEqual(first.eventId, completed.eventId);
    assert.equal(
        first.task.identity.expectedLifecycleVersionEventId,
        first.eventId,
    );
    assert.equal(replay.created, false);
    assert.equal(replay.eventId, first.eventId);
    await expectSubmissionError(
        updateSelectedRaisedBedPlantingLifecycleStatus({
            ...input,
            status: 'sprouted',
        }),
        'submission_conflict',
    );
});

test('serializes concurrent commands with one durable winner', async () => {
    const fixture = await createSelectedTaskFixture();
    const commandId = randomUUID();
    const input = {
        ...commandIdentity(fixture.task, commandId),
        owner: fixture.owner,
        scheduledDate: new Date(Date.now() + 172_800_000).toISOString(),
        sowingLocation: 'direct' as const,
    };
    const results = await Promise.all([
        rescheduleSelectedRaisedBedPlantingTaskForOwner(input),
        rescheduleSelectedRaisedBedPlantingTaskForOwner(input),
    ]);

    assert.deepStrictEqual(results.map((result) => result.created).sort(), [
        false,
        true,
    ]);
    assert.equal(results[0]?.eventId, results[1]?.eventId);
});

test('enforces Farm assignment and owner account membership independently', async () => {
    const fixture = await createSelectedTaskFixture();
    const assigned = await assignSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        assignedUserIds: [fixture.farmerId],
    });
    await expectSubmissionError(
        blockSelectedRaisedBedPlantingTask({
            ...commandIdentity(assigned.task),
            actor: { userId: fixture.otherFarmerId, role: 'farmer' },
            reasonCode: 'missing_materials',
        }),
        'assignment_changed',
    );
    await expectSubmissionError(
        getSelectedRaisedBedPlantingTaskForActor({
            actor: { userId: fixture.outsiderId, role: 'farmer' },
            plantingId: fixture.plantingId,
        }),
        'not_authorized',
    );
    await expectSubmissionError(
        getSelectedRaisedBedPlantingTaskForOwner({
            owner: {
                accountId: fixture.accountId,
                userId: fixture.outsiderId,
            },
            plantingId: fixture.plantingId,
        }),
        'not_authorized',
    );
});

test('applies diary future-date rules to owner reschedule and cancellation', async () => {
    const fixture = await createSelectedTaskFixture();
    await expectSubmissionError(
        rescheduleSelectedRaisedBedPlantingTaskForOwner({
            ...commandIdentity(fixture.task),
            owner: fixture.owner,
            scheduledDate: new Date().toISOString(),
            sowingLocation: 'direct',
        }),
        'invalid_input',
    );
    await expectSubmissionError(
        Reflect.apply(
            rescheduleSelectedRaisedBedPlantingTaskForOwner,
            undefined,
            [
                {
                    ...commandIdentity(fixture.task),
                    owner: fixture.owner,
                    scheduledDate: null,
                    sowingLocation: 'direct',
                },
            ],
        ),
        'invalid_input',
    );

    const unscheduled = await rescheduleSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        scheduledDate: null,
        sowingLocation: 'direct',
    });
    await expectSubmissionError(
        cancelSelectedRaisedBedPlantingTaskForOwner({
            ...commandIdentity(unscheduled.task),
            owner: fixture.owner,
            reason: 'Nema termina.',
        }),
        'invalid_status',
    );

    const scheduledToday = await rescheduleSelectedRaisedBedPlantingTask({
        ...commandIdentity(unscheduled.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        scheduledDate: new Date().toISOString(),
        sowingLocation: 'direct',
    });
    await expectSubmissionError(
        cancelSelectedRaisedBedPlantingTaskForOwner({
            ...commandIdentity(scheduledToday.task),
            owner: fixture.owner,
            reason: 'Prekasno.',
        }),
        'invalid_status',
    );

    const scheduledFuture =
        await rescheduleSelectedRaisedBedPlantingTaskForOwner({
            ...commandIdentity(scheduledToday.task),
            owner: fixture.owner,
            scheduledDate: new Date(Date.now() + 172_800_000).toISOString(),
            sowingLocation: 'direct',
        });
    const cancelled = await cancelSelectedRaisedBedPlantingTaskForOwner({
        ...commandIdentity(scheduledFuture.task),
        owner: fixture.owner,
        reason: 'Promjena plana.',
    });
    assert.equal(cancelled.task.status, 'cancelled');
});

test('cancels one multi-field planting and refunds its immutable purchase once', async () => {
    const fixture = await createSelectedTaskFixture({
        multiField: true,
        sunflowerAmount: 4321,
    });
    const commandId = randomUUID();
    const input = {
        ...commandIdentity(fixture.task, commandId),
        owner: fixture.owner,
        reason: 'Promjena plana.',
    };
    const balanceBefore = await getSunflowers(fixture.accountId);
    const first = await cancelSelectedRaisedBedPlantingTaskForOwner(input);
    const replay = await cancelSelectedRaisedBedPlantingTaskForOwner(input);

    assert.equal(first.created, true);
    assert.equal(first.isActive, false);
    assert.equal(first.task.cancellation?.refundSunflowerAmount, 4321);
    assert.equal(replay.created, false);
    assert.equal(await getSunflowers(fixture.accountId), balanceBefore + 4321);
    assert.equal(
        (await getRaisedBedPlanting(fixture.plantingId))?.memberships.length,
        4,
    );
});

test('rolls back selected cancellation when its immutable refund conflicts', async () => {
    const fixture = await createSelectedTaskFixture({ sunflowerAmount: 4321 });
    const refundReason = `refund:selectedRaisedBedPlanting:${fixture.plantingId.toString()}`;
    await earnSunflowersOnce(fixture.accountId, 1, refundReason);
    const balanceBefore = await getSunflowers(fixture.accountId);

    await assert.rejects(
        cancelSelectedRaisedBedPlantingTaskForOwner({
            ...commandIdentity(fixture.task),
            owner: fixture.owner,
            reason: 'Promjena plana.',
        }),
    );

    const [planting, cancellationEvents] = await Promise.all([
        getRaisedBedPlanting(fixture.plantingId),
        getAllEvents(
            [knownEventTypes.raisedBedPlantings.taskCancelled],
            [fixture.aggregateId],
        ),
    ]);
    assert.equal(planting?.isActive, true);
    assert.equal(planting?.selectedTask?.status, 'planned');
    assert.equal(cancellationEvents.length, 0);
    assert.equal(await getSunflowers(fixture.accountId), balanceBefore);
});

async function createSproutedOperationFixture({
    secondPhysicalBlock = false,
    multiField = true,
}: {
    secondPhysicalBlock?: boolean;
    multiField?: boolean;
} = {}) {
    const fixture = await createSelectedTaskFixture({
        multiField,
        secondPhysicalBlock,
        sowingLocation: 'greenhouse',
    });
    const actor = { userId: fixture.adminId, role: 'admin' as const };
    const sowed = await completeSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor,
    });
    const sprouted = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(sowed.task),
        actor,
        status: 'sprouted',
    });
    await upsertEntityType({ name: 'operation', label: 'Radnja' });
    await storage()
        .insert(entities)
        .values({ id: 593, entityTypeName: 'operation', state: 'published' })
        .onConflictDoNothing();
    const definition = await storage().query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.entityTypeName, 'operation'),
            eq(attributeDefinitions.category, 'attributes'),
            eq(attributeDefinitions.name, 'application'),
            eq(attributeDefinitions.isDeleted, false),
        ),
        orderBy: attributeDefinitions.id,
    });
    const definitionId =
        definition?.id ??
        (await createAttributeDefinition({
            category: 'attributes',
            name: 'application',
            label: 'Primjena',
            entityTypeName: 'operation',
            dataType: 'text',
        }));
    await upsertAttributeValue({
        attributeDefinitionId: definitionId,
        entityTypeName: 'operation',
        entityId: 593,
        value: 'plant',
    });
    await storage()
        .insert(entities)
        .values({ id: 346, entityTypeName: 'operation', state: 'published' })
        .onConflictDoNothing();
    await upsertAttributeValue({
        attributeDefinitionId: definitionId,
        entityTypeName: 'operation',
        entityId: 346,
        value: 'plant',
    });
    return { ...fixture, actor, sprouted };
}

test('explicit multi-field transplant is idempotent and moves location only when verified', async () => {
    const fixture = await createSproutedOperationFixture();
    const input = {
        ...fixture.sprouted.task.identity,
        actor: fixture.actor,
        entityId: 593,
    };
    const first = await createSelectedPlantingOperation(input);
    const replay = await createSelectedPlantingOperation(input);
    assert.equal(first.operationId, replay.operationId);
    assert.equal(replay.created, false);
    const operation = await getOperationById(first.operationId);
    assert.equal(operation.plantingId, fixture.plantingId);
    assert.equal(operation.raisedBedFieldId, null);
    await assert.rejects(
        transplantSelectedRaisedBedPlanting({
            ...commandIdentity(fixture.sprouted.task),
            actor: fixture.actor,
            operationId: first.operationId,
        }),
        /potvrđena radnja/,
    );
    await submitOperationTaskCompletion({
        operationId: first.operationId,
        expectedEntityId: operation.entityId,
        expectedTaskVersionEventId: operation.taskVersionEventId,
        actor: { role: 'farmer', userId: fixture.farmerId },
    });
    assert.equal(
        (await getRaisedBedPlanting(fixture.plantingId))?.selectedTask
            ?.sowingLocation,
        'greenhouse',
    );
    const pending = await getOperationById(first.operationId);
    await verifyOperationTaskCompletion({
        operationId: first.operationId,
        expectedTaskVersionEventId: pending.taskVersionEventId,
        verifiedBy: fixture.adminId,
    });
    const moved = await getRaisedBedPlanting(fixture.plantingId);
    assert.equal(moved?.selectedTask?.sowingLocation, 'direct');
    assert.equal(moved?.selectedTask?.initialSowingLocation, 'greenhouse');
    assert.equal(moved?.lifecycleStatus, 'sprouted');
    assert.equal(moved?.memberships.length, 4);
    assert.equal(moved?.plantCount, 1);
    assert.equal(
        (await getRaisedBedFieldsWithEvents(fixture.raisedBedId)).filter(
            (field) => field.plantSortId,
        ).length,
        0,
    );
    const retry = await submitOperationTaskCompletion({
        operationId: first.operationId,
        actor: fixture.actor,
    });
    assert.equal(retry.created, false);
    assert.equal(
        (await getRaisedBedPlanting(fixture.plantingId))
            ?.lifecycleVersionEventId,
        moved?.lifecycleVersionEventId,
    );
});

test('planting operations reject unauthorized, stale, mixed and retired targets', async () => {
    const fixture = await createSproutedOperationFixture();
    const input = {
        ...fixture.sprouted.task.identity,
        actor: fixture.actor,
        entityId: 593,
    };
    await expectSubmissionError(
        createSelectedPlantingOperation({
            ...input,
            actor: { role: 'farmer', userId: fixture.farmerId },
        }),
        'not_authorized',
    );
    await expectSubmissionError(
        createSelectedPlantingOperation({
            ...input,
            expectedLifecycleVersionEventId:
                fixture.task.identity.expectedLifecycleVersionEventId,
        }),
        'task_changed',
    );
    await expectSubmissionError(
        createSelectedPlantingOperation({ ...input, entityId: 346 }),
        'invalid_status',
    );
    const { operationId } = await createSelectedPlantingOperation(input);
    const operation = await getOperationById(operationId);
    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.ok(field);
    await assert.rejects(
        createOperation({
            entityId: 346,
            entityTypeName: 'operation',
            accountId: operation.accountId,
            gardenId: operation.gardenId,
            raisedBedId: fixture.raisedBedId,
            plantingId: fixture.plantingId,
        }),
        OperationTargetConflictError,
    );
    await assert.rejects(
        createOperation({
            entityId: 593,
            entityTypeName: 'operation',
            accountId: operation.accountId,
            gardenId: operation.gardenId,
            raisedBedId: fixture.raisedBedId,
            plantingId: fixture.plantingId,
            raisedBedFieldId: field.id,
        }),
        OperationTargetConflictError,
    );
    await submitOperationTaskCompletion({
        operationId,
        expectedEntityId: operation.entityId,
        expectedTaskVersionEventId: operation.taskVersionEventId,
        actor: { role: 'farmer', userId: fixture.farmerId },
    });
    const pending = await getOperationById(operationId);
    const died = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(fixture.sprouted.task),
        actor: fixture.actor,
        status: 'died',
    });
    const removal = await createSelectedPlantingOperation({
        ...died.task.identity,
        actor: fixture.actor,
        entityId: 346,
    });
    await submitOperationTaskCompletion({
        operationId: removal.operationId,
        actor: fixture.actor,
    });
    assert.equal(
        (await getRaisedBedPlanting(fixture.plantingId))?.isActive,
        false,
    );
    await assert.rejects(
        verifyOperationTaskCompletion({
            operationId,
            expectedTaskVersionEventId: pending.taskVersionEventId,
            verifiedBy: fixture.adminId,
        }),
        OperationTargetConflictError,
    );
    assert.equal(
        (await getOperationById(operationId)).status,
        'pendingVerification',
    );
    assert.equal(
        (await getRaisedBedPlanting(fixture.plantingId))?.selectedTask
            ?.sowingLocation,
        'greenhouse',
    );
});

async function harvestDefinition() {
    const id = await createEntity('operation');
    const nameId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'operation',
        dataType: 'text',
    });
    await upsertAttributeValue({
        attributeDefinitionId: nameId,
        entityTypeName: 'operation',
        entityId: id,
        value: 'HarvestPlant',
    });
    const application = await storage().query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.entityTypeName, 'operation'),
            eq(attributeDefinitions.category, 'attributes'),
            eq(attributeDefinitions.name, 'application'),
            eq(attributeDefinitions.isDeleted, false),
        ),
        orderBy: attributeDefinitions.id,
    });
    assert.ok(application);
    await upsertAttributeValue({
        attributeDefinitionId: application.id,
        entityTypeName: 'operation',
        entityId: id,
        value: 'plant',
    });
    await updateEntity({ id, state: 'published' });
    return id;
}

test('selected multi-field harvest has one canonical QR trace and preserves Farm scope', async () => {
    const fixture = await createSproutedOperationFixture();
    const entityId = await harvestDefinition();
    const harvest = await createSelectedPlantingOperation({
        ...fixture.sprouted.task.identity,
        actor: fixture.actor,
        entityId,
    });
    await submitOperationTaskCompletion({
        operationId: harvest.operationId,
        actor: fixture.actor,
    });
    const [link, replay] = await Promise.all([
        createOrGetSelectedPlantingHarvestTraceLink({
            plantingId: fixture.plantingId,
            harvestOperationId: harvest.operationId,
        }),
        createOrGetSelectedPlantingHarvestTraceLink({
            plantingId: fixture.plantingId,
            harvestOperationId: harvest.operationId,
        }),
    ]);
    assert.equal(link.id, replay.id);
    assert.equal(link.plantingId, fixture.plantingId);
    assert.equal(link.plantPlaceEventId, null);
    assert.equal(link.fieldLabel, '14, 15, 17, 18');
    const trace = await getPublicHarvestTraceByToken(link.publicToken);
    assert.ok(trace);
    assert.equal(trace.context.fieldLabel, link.fieldLabel);
    assert.ok(trace.timeline.some((item) => item.plantStatus === 'sprouted'));
    assert.ok(
        trace.timeline.some((item) => item.description?.includes('plasteniku')),
    );
    assert.deepEqual(
        await getFarmUserPrintableHarvestTraceLinkIds(fixture.farmerId, [
            link.id,
        ]),
        [link.id],
    );
    assert.deepEqual(
        await getFarmUserPrintableHarvestTraceLinkIds(fixture.outsiderId, [
            link.id,
        ]),
        [],
    );
    await assert.rejects(
        createOrGetSelectedPlantingHarvestTraceLink({
            plantingId: fixture.plantingId + 1,
            harvestOperationId: harvest.operationId,
        }),
        /canonical/,
    );
    await assert.rejects(
        createOrGetHarvestTraceLink({
            accountId: fixture.accountId,
            gardenId: link.gardenId,
            raisedBedId: fixture.raisedBedId,
            raisedBedFieldId: link.raisedBedFieldId,
            fieldPositionIndex: 0,
            fieldLabel: '1',
            plantPlaceEventId:
                fixture.task.identity.expectedLifecycleVersionEventId,
            harvestOperationId: harvest.operationId,
        }),
        /explicit planting trace/,
    );
});

test('selected harvest trace never includes care performed on a co-plant', async () => {
    const fixture = await createSproutedOperationFixture();
    const original = await getRaisedBedPlanting(fixture.plantingId);
    assert.ok(original);
    const second = await createRaisedBedPlanting({
        raisedBedId: original.raisedBedId,
        plantSortId: original.plantSortId,
        eventAggregateId: `selected-co-plant:${randomUUID()}`,
        anchorPositionIndex: original.anchorPositionIndex,
        minSeedingDistanceCm: 15,
        optimalSeedingDistanceCm: 30,
        maxSeedingDistanceCm: 60,
        selectedSeedingDistanceCm: 15,
        plantsPerAxis: 2,
        plantCount: 4,
        layoutKey: 'v1:fields:1x1:plants:2x2',
        spanRows: 1,
        spanColumns: 1,
        layoutVersion: 1,
        configurationSource: 'selected',
        lifecycleStarted: {
            commandId: randomUUID(),
            scheduledDate: new Date().toISOString(),
            sowingLocation: 'direct',
            startedBy: fixture.adminId,
        },
        memberships: original.memberships
            .filter((member) => member.isAnchor)
            .map((member) => ({
                raisedBedFieldId: member.raisedBedFieldId,
                relativeRow: member.relativeRow,
                relativeColumn: member.relativeColumn,
                isAnchor: member.isAnchor,
            })),
    });
    assert.ok(second.planting.selectedTask);
    const completed = await completeSelectedRaisedBedPlantingTask({
        ...commandIdentity(second.planting.selectedTask),
        actor: fixture.actor,
    });
    const entityId = await harvestDefinition();
    const otherHarvest = await createSelectedPlantingOperation({
        ...completed.task.identity,
        actor: fixture.actor,
        entityId,
    });
    await submitOperationTaskCompletion({
        operationId: otherHarvest.operationId,
        actor: fixture.actor,
        imageUrls: ['https://example.com/other-plant-private.jpg'],
    });
    const ownHarvest = await createSelectedPlantingOperation({
        ...fixture.sprouted.task.identity,
        actor: fixture.actor,
        entityId,
    });
    await submitOperationTaskCompletion({
        operationId: ownHarvest.operationId,
        actor: fixture.actor,
    });
    const link = await createOrGetSelectedPlantingHarvestTraceLink({
        plantingId: fixture.plantingId,
        harvestOperationId: ownHarvest.operationId,
    });
    const trace = await getPublicHarvestTraceByToken(link.publicToken);
    assert.ok(trace);
    assert.ok(!JSON.stringify(trace).includes('other-plant-private'));
    assert.ok(
        !JSON.stringify(trace).includes('expectedLifecycleVersionEventId'),
    );
});

test('selected harvest traces use physical numbering in a second logical block', async () => {
    const fixture = await createSproutedOperationFixture({
        secondPhysicalBlock: true,
        multiField: false,
    });
    const entityId = await harvestDefinition();
    const harvest = await createSelectedPlantingOperation({
        ...fixture.sprouted.task.identity,
        actor: fixture.actor,
        entityId,
    });
    await submitOperationTaskCompletion({
        operationId: harvest.operationId,
        actor: fixture.actor,
    });
    const link = await createOrGetSelectedPlantingHarvestTraceLink({
        plantingId: fixture.plantingId,
        harvestOperationId: harvest.operationId,
    });
    assert.equal(link.fieldPositionIndex, 0);
    assert.equal(link.fieldLabel, '10');
    const trace = await getPublicHarvestTraceByToken(link.publicToken);
    assert.equal(trace?.context.fieldLabel, '10');
});

test('admin corrects a grown multi-field planting while preserving its lifecycle, layout and purchase', async () => {
    const fixture = await createSelectedTaskFixture({ multiField: true });
    const actor: { role: 'admin'; userId: string } = {
        role: 'admin',
        userId: fixture.adminId,
    };
    const completed = await completeSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor,
    });
    await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(completed.task),
        actor,
        status: 'sprouted',
    });
    const before = await getRaisedBedPlanting(fixture.plantingId);
    assert.ok(before?.selectedTask);
    const plantSortId = await createEntity('plantSort');
    const input = {
        ...commandIdentity(before.selectedTask),
        actor,
        plantSortId,
    };
    const changed = await correctSelectedRaisedBedPlantingSort(input);
    const retry = await correctSelectedRaisedBedPlantingSort(input);
    assert.equal(changed.eventId, retry.eventId);
    const after = await getRaisedBedPlanting(fixture.plantingId);
    assert.ok(after?.selectedTask);
    assert.equal(after.plantSortId, plantSortId);
    const replay = await createRaisedBedPlanting(fixture.plantingInput);
    assert.equal(replay.created, false);
    assert.equal(replay.planting.id, fixture.plantingId);
    assert.equal(replay.planting.plantSortId, plantSortId);
    assert.equal(after.selectedTask.initialPlantSortId, fixture.plantSortId);
    assert.equal(after.lifecycleStatus, 'sprouted');
    assert.deepEqual(
        after.lifecycleStatusChanges,
        before.lifecycleStatusChanges,
    );
    assert.deepEqual(after.lifecycleStartedAt, before.lifecycleStartedAt);
    assert.deepEqual(after.memberships, before.memberships);
    assert.equal(after.plantCount, before.plantCount);
    assert.equal(
        after.selectedSeedingDistanceCm,
        before.selectedSeedingDistanceCm,
    );
    assert.deepEqual(after.selectedTask.purchase, before.selectedTask.purchase);
    assert.equal(after.selectedTask.identity.expectedPlantSortId, plantSortId);
    assert.equal(after.lifecycleVersionEventId, changed.eventId);
    await expectSubmissionError(
        correctSelectedRaisedBedPlantingSort({
            ...input,
            commandId: randomUUID(),
        }),
        'task_changed',
    );
    await expectSubmissionError(
        correctSelectedRaisedBedPlantingSort({
            ...commandIdentity(after.selectedTask),
            actor: { role: 'farmer', userId: fixture.farmerId },
            plantSortId: fixture.plantSortId,
        }),
        'not_authorized',
    );
    const operationId = await createEntity('operation');
    await expectSubmissionError(
        correctSelectedRaisedBedPlantingSort({
            ...commandIdentity(after.selectedTask),
            actor,
            plantSortId: operationId,
        }),
        'invalid_input',
    );
    const next = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(after.selectedTask),
        actor,
        status: 'firstFlowers',
    });
    assert.equal(next.lifecycleStatus, 'firstFlowers');
    assert.equal(next.task.identity.expectedPlantSortId, plantSortId);
});
