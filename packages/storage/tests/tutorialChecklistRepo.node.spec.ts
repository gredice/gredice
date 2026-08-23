import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    claimTutorialChecklistTask,
    createAccountInvitation,
    createEntity,
    createRaisedBed,
    createUserWithPassword,
    getOrCreateShoppingCart,
    getSunflowers,
    getTutorialChecklistState,
    getUser,
    markTutorialChecklistTaskReady,
    setUserFavorite,
    TutorialChecklistTaskNotClaimableError,
    updateGarden,
    upsertEntityType,
    upsertOrRemoveCartItem,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createChecklistTestUser() {
    await ensureFarmId();
    const userName = `checklist-${randomUUID()}@example.test`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    const accountId = user?.accounts[0]?.accountId;
    if (!accountId) {
        throw new Error('Test user account was not created');
    }
    return { accountId, userId };
}

function findChecklistTask(
    state: Awaited<ReturnType<typeof getTutorialChecklistState>>,
    taskKey: string,
) {
    return state.groups
        .flatMap((group) => group.tasks)
        .find((task) => task.key === taskKey);
}

test('tutorial checklist returns day groups and open tasks', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();

    const state = await getTutorialChecklistState({ accountId, userId });

    assert.deepStrictEqual(
        state.groups.map((group) => group.id),
        ['day-1', 'day-2', 'day-3', 'open'],
    );
    assert.ok(state.totals.totalCount >= 30);
    assert.ok(
        state.groups
            .flatMap((group) => group.tasks)
            .some((task) => task.key === 'order-watering'),
    );
    const allTasks = state.groups.flatMap((group) => group.tasks);
    const onboardingTask = findChecklistTask(
        state,
        'complete-first-raised-bed-onboarding',
    );
    assert.ok(onboardingTask);
    assert.strictEqual(onboardingTask.status, 'available');
    assert.strictEqual(onboardingTask.claimable, false);
    assert.strictEqual(onboardingTask.actionTarget, 'raisedBedOnboarding');
    const openCartTask = allTasks.find((task) => task.key === 'open-cart');
    assert.ok(openCartTask);
    assert.strictEqual(openCartTask.status, 'available');
    assert.strictEqual(openCartTask.claimable, false);
    assert.ok(
        state.groups
            .find((group) => group.id === 'open')
            ?.tasks.some((task) => task.key === 'enter-referral-code'),
    );
    assert.strictEqual(state.totals.claimableCount, 0);
});

test('tutorial checklist treats an active raised bed as first plan progress', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'checklist-active-bed');

    await createRaisedBed({
        accountId,
        gardenId,
        blockId,
        status: 'active',
    });

    const state = await getTutorialChecklistState({ accountId, userId });
    const task = findChecklistTask(
        state,
        'complete-first-raised-bed-onboarding',
    );

    assert.ok(task);
    assert.strictEqual(task.status, 'ready');
    assert.strictEqual(task.claimable, true);
    assert.strictEqual(task.completed, false);
});

test('tutorial checklist rewards making a garden public once', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });

    let state = await getTutorialChecklistState({ accountId, userId });
    let task = findChecklistTask(state, 'make-garden-public');
    assert.ok(task);
    assert.strictEqual(task.rewardSunflowers, 500);
    assert.strictEqual(task.status, 'available');
    assert.strictEqual(task.claimable, false);

    await updateGarden({ id: gardenId, isPublic: true });

    state = await getTutorialChecklistState({ accountId, userId });
    task = findChecklistTask(state, 'make-garden-public');
    assert.ok(task);
    assert.strictEqual(task.status, 'ready');
    assert.strictEqual(task.claimable, true);

    await claimTutorialChecklistTask({
        accountId,
        userId,
        taskKey: 'make-garden-public',
    });

    assert.strictEqual(await getSunflowers(accountId), 1500);
    await assert.rejects(
        () =>
            claimTutorialChecklistTask({
                accountId,
                userId,
                taskKey: 'make-garden-public',
            }),
        TutorialChecklistTaskNotClaimableError,
    );
    assert.strictEqual(await getSunflowers(accountId), 1500);
});

test('tutorial checklist notification settings task becomes claimable after visiting settings', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();

    const state = await markTutorialChecklistTaskReady({
        accountId,
        userId,
        taskKey: 'configure-notifications',
    });
    const task = findChecklistTask(state, 'configure-notifications');

    assert.ok(task);
    assert.strictEqual(task.status, 'ready');
    assert.strictEqual(task.claimable, true);
});

test('tutorial checklist treats pending account invitations as invite progress', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();

    await createAccountInvitation(
        accountId,
        `invite-${randomUUID()}@example.test`,
        userId,
    );

    const state = await getTutorialChecklistState({ accountId, userId });
    const task = findChecklistTask(state, 'invite-account-user');

    assert.ok(task);
    assert.strictEqual(task.status, 'ready');
    assert.strictEqual(task.claimable, true);
});

test('tutorial checklist treats saved favorites as favorite progress', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();
    await upsertEntityType({ name: 'plant', label: 'Plant' });
    const plantId = await createEntity('plant');

    await setUserFavorite({
        userId,
        entityType: 'plant',
        entityId: plantId,
        favorited: true,
    });

    const state = await getTutorialChecklistState({ accountId, userId });
    const task = findChecklistTask(state, 'favorite-one-item');

    assert.ok(task);
    assert.strictEqual(task.actionTarget, 'plantPicker');
    assert.strictEqual(task.status, 'ready');
    assert.strictEqual(task.claimable, true);
});

test('tutorial checklist manual task becomes claimable before reward claim', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();

    const initialState = await getTutorialChecklistState({ accountId, userId });
    const initialTask = initialState.groups
        .flatMap((group) => group.tasks)
        .find((candidate) => candidate.key === 'open-operations');
    assert.ok(initialTask);
    assert.strictEqual(initialTask.status, 'available');
    assert.strictEqual(initialTask.claimable, false);
    assert.strictEqual(initialTask.completed, false);

    await assert.rejects(
        () =>
            claimTutorialChecklistTask({
                accountId,
                userId,
                taskKey: 'open-operations',
            }),
        TutorialChecklistTaskNotClaimableError,
    );
    assert.strictEqual(await getSunflowers(accountId), 1000);

    const readyState = await markTutorialChecklistTaskReady({
        accountId,
        userId,
        taskKey: 'open-operations',
    });
    const readyTask = readyState.groups
        .flatMap((group) => group.tasks)
        .find((candidate) => candidate.key === 'open-operations');
    assert.ok(readyTask);
    assert.strictEqual(readyTask.status, 'ready');
    assert.strictEqual(readyTask.claimable, true);
    assert.strictEqual(readyTask.completed, false);
    assert.strictEqual(await getSunflowers(accountId), 1000);

    await claimTutorialChecklistTask({
        accountId,
        userId,
        taskKey: 'open-operations',
    });

    assert.strictEqual(await getSunflowers(accountId), 1010);
    const state = await getTutorialChecklistState({ accountId, userId });
    const task = state.groups
        .flatMap((group) => group.tasks)
        .find((candidate) => candidate.key === 'open-operations');
    assert.ok(task);
    assert.strictEqual(task.status, 'claimed');
    assert.strictEqual(task.claimable, false);
    assert.strictEqual(task.completed, true);

    await assert.rejects(
        () =>
            claimTutorialChecklistTask({
                accountId,
                userId,
                taskKey: 'open-operations',
            }),
        TutorialChecklistTaskNotClaimableError,
    );
    assert.strictEqual(await getSunflowers(accountId), 1010);
});

test('tutorial checklist rejects derived task before signal exists', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();

    await assert.rejects(
        () =>
            claimTutorialChecklistTask({
                accountId,
                userId,
                taskKey: 'plant-first',
            }),
        TutorialChecklistTaskNotClaimableError,
    );
});

test('tutorial checklist treats raised-bed plant cart placements as planting progress', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'checklist-bed');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);

    for (const positionIndex of Array.from(
        { length: 9 },
        (_, index) => index,
    )) {
        await upsertOrRemoveCartItem(
            null,
            cart.id,
            (1000 + positionIndex).toString(),
            'plantSort',
            1,
            gardenId,
            raisedBedId,
            positionIndex,
        );
    }

    const state = await getTutorialChecklistState({ accountId, userId });
    const dayOne = state.groups.find((group) => group.id === 'day-1');
    assert.ok(dayOne);
    const plantFirstTask = dayOne.tasks.find(
        (task) => task.key === 'plant-first',
    );
    const plantNineTask = dayOne.tasks.find(
        (task) => task.key === 'plant-nine-in-bed',
    );

    assert.ok(plantFirstTask);
    assert.ok(plantNineTask);
    assert.strictEqual(plantFirstTask.status, 'ready');
    assert.strictEqual(plantFirstTask.claimable, true);
    assert.strictEqual(plantFirstTask.completed, false);
    assert.strictEqual(plantNineTask.status, 'ready');
    assert.strictEqual(plantNineTask.claimable, true);
    assert.strictEqual(plantNineTask.completed, false);
});
