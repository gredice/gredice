import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    backfillTutorialChecklistRewards,
    claimTutorialChecklistTask,
    createUserWithPassword,
    getSunflowers,
    getTutorialChecklistState,
    getUser,
    TutorialChecklistTaskNotClaimableError,
    updateUser,
} from '@gredice/storage';
import { ensureFarmId } from './helpers/testHelpers';
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
});

test('tutorial checklist manual claim grants reward once', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();

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

test('tutorial checklist backfill grants already completed derived rewards once', async () => {
    createTestDb();
    const { accountId, userId } = await createChecklistTestUser();
    await updateUser({
        id: userId,
        displayName: 'Checklist Tester',
    });

    const dryRun = await backfillTutorialChecklistRewards({
        accountIds: [accountId],
    });
    assert.strictEqual(dryRun.dryRun, true);
    assert.strictEqual(dryRun.scannedAccounts, 1);
    assert.strictEqual(dryRun.wouldCreateClaims, 1);
    assert.strictEqual(dryRun.wouldGrantSunflowers, 100);
    assert.strictEqual(await getSunflowers(accountId), 1000);

    const applied = await backfillTutorialChecklistRewards({
        accountIds: [accountId],
        dryRun: false,
    });
    assert.strictEqual(applied.createdClaims, 1);
    assert.strictEqual(applied.grantedSunflowers, 100);
    assert.strictEqual(await getSunflowers(accountId), 1100);

    const secondApplied = await backfillTutorialChecklistRewards({
        accountIds: [accountId],
        dryRun: false,
    });
    assert.strictEqual(secondApplied.createdClaims, 0);
    assert.strictEqual(secondApplied.grantedSunflowers, 0);
    assert.strictEqual(secondApplied.existingClaims, 1);
    assert.strictEqual(await getSunflowers(accountId), 1100);
});
