import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    assignSelectedRaisedBedPlantingTask,
    assignUserToFarm,
    blockSelectedRaisedBedPlantingTask,
    cancelSelectedRaisedBedPlantingTaskForOwner,
    completeSelectedRaisedBedPlantingTask,
    createAccount,
    createEntity,
    createFarm,
    createRaisedBedPlanting,
    earnSunflowersOnce,
    ensureSelectedRaisedBedPlantingSowedNotification,
    getAllEvents,
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
    rescheduleSelectedRaisedBedPlantingTask,
    rescheduleSelectedRaisedBedPlantingTaskForOwner,
    ScheduleTaskSubmissionError,
    type SelectedRaisedBedPlantingTaskReadModel,
    storage,
    updateSelectedRaisedBedPlantingLifecycleStatus,
    updateSelectedRaisedBedPlantingLifecycleStatusForOwner,
    upsertEntityType,
    upsertRaisedBedField,
    users,
    verifySelectedRaisedBedPlantingTask,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
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
}: {
    multiField?: boolean;
    sunflowerAmount?: number;
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
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
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
    const planting = await createRaisedBedPlanting({
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
            sowingLocation: 'direct',
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
    });
    assert.ok(planting.planting.selectedTask);
    return {
        accountId,
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

    const corrected =
        await updateSelectedRaisedBedPlantingLifecycleStatusForOwner({
            ...commandIdentity(failed.task),
            owner: fixture.owner,
            status: 'sprouted',
        });
    assert.equal(corrected.isActive, true);
    assert.equal(corrected.lifecycleStoppedAt, null);

    const died = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(corrected.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        status: 'died',
    });
    const removed =
        await updateSelectedRaisedBedPlantingLifecycleStatusForOwner({
            ...commandIdentity(died.task),
            owner: fixture.owner,
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

test('keeps owner lifecycle changes behind task verification and the Garden user graph', async () => {
    const fixture = await createSelectedTaskFixture();
    await expectSubmissionError(
        updateSelectedRaisedBedPlantingLifecycleStatusForOwner({
            ...commandIdentity(fixture.task),
            owner: fixture.owner,
            status: 'sowed',
        }),
        'invalid_status',
    );
    await expectSubmissionError(
        Reflect.apply(
            updateSelectedRaisedBedPlantingLifecycleStatusForOwner,
            undefined,
            [
                {
                    ...commandIdentity(fixture.task),
                    owner: fixture.owner,
                    status: 'pendingVerification',
                },
            ],
        ),
        'invalid_input',
    );
    await expectSubmissionError(
        Reflect.apply(
            updateSelectedRaisedBedPlantingLifecycleStatusForOwner,
            undefined,
            [
                {
                    ...commandIdentity(fixture.task),
                    owner: fixture.owner,
                    status: 'cancelled',
                },
            ],
        ),
        'invalid_input',
    );

    const completed = await completeSelectedRaisedBedPlantingTask({
        ...commandIdentity(fixture.task),
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    await expectSubmissionError(
        updateSelectedRaisedBedPlantingLifecycleStatusForOwner({
            ...commandIdentity(completed.task),
            owner: fixture.owner,
            status: 'sprouted',
        }),
        'invalid_status',
    );

    const verified = await verifySelectedRaisedBedPlantingTask({
        ...commandIdentity(completed.task),
        actor: { userId: fixture.adminId, role: 'admin' },
    });
    await expectSubmissionError(
        updateSelectedRaisedBedPlantingLifecycleStatusForOwner({
            ...commandIdentity(verified.task),
            owner: fixture.owner,
            status: 'firstFlowers',
        }),
        'invalid_status',
    );
    const sprouted =
        await updateSelectedRaisedBedPlantingLifecycleStatusForOwner({
            ...commandIdentity(verified.task),
            owner: fixture.owner,
            status: 'sprouted',
        });
    const ready = await updateSelectedRaisedBedPlantingLifecycleStatusForOwner({
        ...commandIdentity(sprouted.task),
        owner: fixture.owner,
        status: 'ready',
    });
    await expectSubmissionError(
        updateSelectedRaisedBedPlantingLifecycleStatusForOwner({
            ...commandIdentity(ready.task),
            owner: fixture.owner,
            status: 'removed',
        }),
        'invalid_status',
    );
    const harvested = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...commandIdentity(ready.task),
        actor: { userId: fixture.adminId, role: 'admin' },
        status: 'harvested',
    });
    const removed =
        await updateSelectedRaisedBedPlantingLifecycleStatusForOwner({
            ...commandIdentity(harvested.task),
            owner: fixture.owner,
            status: 'removed',
        });
    assert.equal(removed.isActive, false);
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
