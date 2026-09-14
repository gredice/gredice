import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    aiChatConversations,
    aiUsageLedger,
    attachTemporaryAccountsToUser,
    cleanupInactiveTemporaryAccounts,
    createEntity,
    createOrUpdateUserPasswordLogin,
    createOrUpdateUserWithOauth,
    createRefreshToken,
    createSandboxGarden,
    createTemporaryUserAndAccount,
    createUserWithPassword,
    deleteGardenIfNoActiveRaisedBeds,
    ensureRegisteredUserAccount,
    events,
    farms,
    gardenVisitStates,
    getAccountGardensMetadata,
    getGardenBlocks,
    getGardenStacks,
    getRaisedBeds,
    getUsersWithBirthdayOn,
    listUserFavorites,
    notificationEmailLog,
    notifications,
    promoteTemporaryUser,
    refreshTokens,
    retireTemporaryUserForCleanup,
    setUserFavorite,
    storage,
    touchTemporaryUserActivity,
    upsertEntityType,
    userLogins,
    users,
} from '@gredice/storage';
import { eq, inArray } from 'drizzle-orm';
import { createTestAccount, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

const TEST_USER_EMAIL = 'birthday@example.com';

async function createFavoriteTarget(entityTypeName: 'plant' | 'plantSort') {
    await upsertEntityType({
        name: entityTypeName,
        label: entityTypeName,
    });

    return await createEntity(entityTypeName);
}

test('getUsersWithBirthdayOn returns users with matching birthdays', async () => {
    createTestDb();

    const accountId = await createTestAccount();
    const userId = randomUUID();
    const db = storage();

    await db.insert(users).values({
        id: userId,
        userName: TEST_USER_EMAIL,
        displayName: 'Rođendan',
        role: 'user',
        birthdayDay: 15,
        birthdayMonth: 7,
        birthdayYear: 1990,
        birthdayLastUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await db.insert(accountUsers).values({
        accountId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    const matchingUsers = await getUsersWithBirthdayOn(7, 15);
    assert.ok(
        matchingUsers.some((user) => user.id === userId),
        'Expected to find the inserted user',
    );

    const nonMatchingUsers = await getUsersWithBirthdayOn(12, 1);
    assert.ok(
        !nonMatchingUsers.some((user) => user.id === userId),
        'Unexpectedly found user in non-matching query',
    );
});

test('createTemporaryUserAndAccount creates a fully featured standard garden', async () => {
    createTestDb();
    await ensureFarmId();

    const temporary = await createTemporaryUserAndAccount();
    const user = await storage().query.users.findFirst({
        where: eq(users.id, temporary.userId),
    });
    assert.ok(user);
    assert.equal(user.isTemporary, true);
    assert.equal(user.role, 'user');
    assert.equal(user.userName, temporary.displayName);
    assert.match(user.userName, /\d{4}$/u);
    assert.doesNotMatch(user.userName, /@/u);

    const gardens = await getAccountGardensMetadata(temporary.accountId);
    assert.equal(gardens.length, 1);
    assert.equal(gardens[0].isSandbox, false);
    assert.equal(gardens[0].name, 'Moj vrt');

    const stacks = await getGardenStacks(gardens[0].id);
    assert.equal(stacks.length, 12);

    const blocks = await getGardenBlocks(gardens[0].id);
    assert.equal(
        blocks.filter((block) => block.name === 'Block_Grass').length,
        12,
    );
    assert.equal(
        blocks.filter((block) => block.name === 'Raised_Bed').length,
        1,
    );

    const raisedBeds = await getRaisedBeds(gardens[0].id);
    assert.equal(raisedBeds.length, 1);
    assert.equal(raisedBeds[0]?.status, 'new');
});

test('ensureRegisteredUserAccount repairs an accountless login once', async () => {
    createTestDb();
    await ensureFarmId();

    const userId = await createUserWithPassword(
        `accountless-${randomUUID()}@example.com`,
        'secret-password',
    );
    await storage().delete(accountUsers).where(eq(accountUsers.userId, userId));

    const accountCountBeforeFailedRepair = (
        await storage().query.accounts.findMany()
    ).length;
    const gardenCountBeforeFailedRepair = (
        await storage().query.gardens.findMany()
    ).length;
    const activeFarms = await storage().query.farms.findMany({
        columns: { id: true },
        where: eq(farms.isDeleted, false),
    });
    assert.ok(activeFarms.length > 0);
    await storage()
        .update(farms)
        .set({ isDeleted: true })
        .where(eq(farms.isDeleted, false));

    try {
        await assert.rejects(
            ensureRegisteredUserAccount(userId),
            /No farm found/,
        );
        assert.equal(
            (await storage().query.accounts.findMany()).length,
            accountCountBeforeFailedRepair,
        );
        assert.equal(
            (await storage().query.gardens.findMany()).length,
            gardenCountBeforeFailedRepair,
        );
    } finally {
        await storage()
            .update(farms)
            .set({ isDeleted: false })
            .where(
                inArray(
                    farms.id,
                    activeFarms.map((farm) => farm.id),
                ),
            );
    }

    const [firstAccountId, secondAccountId] = await Promise.all([
        ensureRegisteredUserAccount(userId),
        ensureRegisteredUserAccount(userId),
    ]);

    assert.equal(firstAccountId, secondAccountId);
    const memberships = await storage().query.accountUsers.findMany({
        where: eq(accountUsers.userId, userId),
    });
    assert.deepEqual(
        memberships.map((membership) => membership.accountId),
        [firstAccountId],
    );

    const gardens = await getAccountGardensMetadata(firstAccountId);
    assert.equal(gardens.length, 1);
    assert.equal(gardens[0].isSandbox, false);
    assert.equal(gardens[0].name, 'Moj vrt');
});

test('existing-user OAuth login leaves the temporary account isolated', async () => {
    createTestDb();
    await ensureFarmId();

    const email = `existing-oauth-${randomUUID()}@example.com`;
    const targetUserId = await createUserWithPassword(email, 'secret-password');
    const temporary = await createTemporaryUserAndAccount();

    const result = await createOrUpdateUserWithOauth(
        {
            name: 'Existing user',
            email,
            provider: 'google',
            providerUserId: `google-${randomUUID()}`,
        },
        temporary.userId,
    );

    assert.equal(result.userId, targetUserId);
    assert.equal(result.isNewUser, false);
    assert.equal(result.temporaryUserIdToRetire, temporary.userId);

    const targetLinks = await storage().query.accountUsers.findMany({
        where: eq(accountUsers.userId, targetUserId),
    });
    assert.equal(targetLinks.length, 1);
    assert.equal(
        targetLinks.some((link) => link.accountId === temporary.accountId),
        false,
    );

    const temporaryLink = await storage().query.accountUsers.findFirst({
        where: eq(accountUsers.accountId, temporary.accountId),
    });
    assert.equal(temporaryLink?.userId, temporary.userId);
});

test('retiring a temporary user revokes authentication and makes cleanup eligible', async () => {
    createTestDb();
    await ensureFarmId();

    const temporary = await createTemporaryUserAndAccount();
    await createRefreshToken(temporary.userId);

    assert.equal(await retireTemporaryUserForCleanup(temporary.userId), true);

    const retiredUser = await storage().query.users.findFirst({
        where: eq(users.id, temporary.userId),
    });
    assert.equal(retiredUser?.isTemporary, true);
    assert.equal(retiredUser?.lastActiveAt.getTime(), 0);

    await touchTemporaryUserActivity(temporary.userId, {
        force: true,
        now: new Date('2026-08-25T11:59:59.000Z'),
    });
    const userAfterInFlightTouch = await storage().query.users.findFirst({
        where: eq(users.id, temporary.userId),
    });
    assert.equal(userAfterInFlightTouch?.lastActiveAt.getTime(), 0);

    const remainingRefreshToken = await storage().query.refreshTokens.findFirst(
        {
            where: eq(refreshTokens.userId, temporary.userId),
        },
    );
    assert.equal(remainingRefreshToken, undefined);

    const temporaryLink = await storage().query.accountUsers.findFirst({
        where: eq(accountUsers.accountId, temporary.accountId),
    });
    assert.equal(temporaryLink?.userId, temporary.userId);

    const cleanup = await cleanupInactiveTemporaryAccounts({
        now: new Date('2026-08-25T12:00:00.000Z'),
    });
    assert.equal(cleanup.deletedUsers, 1);
    assert.equal(cleanup.deletedAccounts, 1);
});

test('promotion cannot revive an identity after retirement wins the row lock', async () => {
    createTestDb();
    await ensureFarmId();

    const temporary = await createTemporaryUserAndAccount();
    assert.equal(await retireTemporaryUserForCleanup(temporary.userId), true);

    await assert.rejects(
        promoteTemporaryUser({
            userId: temporary.userId,
            userName: `retired-${randomUUID()}@example.com`,
        }),
        /Temporary user not found/,
    );

    const retiredUser = await storage().query.users.findFirst({
        where: eq(users.id, temporary.userId),
    });
    assert.equal(retiredUser?.isTemporary, true);
    assert.equal(retiredUser?.lastActiveAt.getTime(), 0);

    const cleanup = await cleanupInactiveTemporaryAccounts({
        now: new Date('2026-08-25T12:00:00.000Z'),
    });
    assert.equal(cleanup.deletedUsers, 1);
    assert.equal(cleanup.deletedAccounts, 1);
});

test('promoteTemporaryUser converts a temporary user to email identity', async () => {
    createTestDb();
    await ensureFarmId();

    const temporary = await createTemporaryUserAndAccount();
    const playGardenId = await createSandboxGarden({
        accountId: temporary.accountId,
        name: 'Igra ostaje igra',
    });
    const promotedEmail = `promoted-temp-${randomUUID()}@example.com`;
    await createOrUpdateUserPasswordLogin(
        temporary.userId,
        promotedEmail,
        'secret-password',
    );

    await promoteTemporaryUser({
        userId: temporary.userId,
        userName: promotedEmail,
    });

    const user = await storage().query.users.findFirst({
        where: eq(users.id, temporary.userId),
    });
    assert.ok(user);
    assert.equal(user.isTemporary, false);
    assert.equal(user.userName, promotedEmail);

    const login = await storage().query.userLogins.findFirst({
        where: eq(userLogins.userId, temporary.userId),
    });
    assert.equal(login?.loginId, promotedEmail);

    assert.equal(await retireTemporaryUserForCleanup(temporary.userId), false);
    const loginAfterRetirementAttempt =
        await storage().query.userLogins.findFirst({
            where: eq(userLogins.userId, temporary.userId),
        });
    assert.equal(loginAfterRetirementAttempt?.id, login?.id);

    const gardens = await getAccountGardensMetadata(temporary.accountId);
    assert.equal(
        gardens.find((garden) => garden.id === playGardenId)?.isSandbox,
        true,
    );
    assert.equal(
        gardens.find((garden) => garden.id !== playGardenId)?.isSandbox,
        false,
    );
});

test('attachTemporaryAccountsToUser moves accounts, favorites, and deletes temporary auth rows', async () => {
    createTestDb();
    await ensureFarmId();

    const targetUserId = await createUserWithPassword(
        `target-${randomUUID()}@example.com`,
        'secret-password',
    );
    const temporary = await createTemporaryUserAndAccount();
    const playGardenId = await createSandboxGarden({
        accountId: temporary.accountId,
        name: 'Prenesena igra',
    });
    await createOrUpdateUserPasswordLogin(
        temporary.userId,
        `temp-${randomUUID()}@example.com`,
        'secret-password',
    );
    await createRefreshToken(temporary.userId);
    const plantId = await createFavoriteTarget('plant');
    const plantSortId = await createFavoriteTarget('plantSort');
    await setUserFavorite({
        userId: temporary.userId,
        entityType: 'plant',
        entityId: plantId,
        favorited: true,
    });
    const [temporaryGarden] = await getAccountGardensMetadata(
        temporary.accountId,
    );
    const conversationId = randomUUID();
    const notificationId = randomUUID();
    await storage().insert(aiChatConversations).values({
        id: conversationId,
        accountId: temporary.accountId,
        userId: temporary.userId,
        gardenId: temporaryGarden.id,
    });
    await storage().insert(aiUsageLedger).values({
        id: randomUUID(),
        accountId: temporary.accountId,
        userId: temporary.userId,
        conversationId,
        requestId: randomUUID(),
        model: 'test-model',
        usageDate: '2026-08-23',
        status: 'completed',
    });
    await storage().insert(notifications).values({
        id: notificationId,
        header: 'Temporary notification',
        content: 'Temporary content',
        accountId: temporary.accountId,
        userId: temporary.userId,
        timestamp: new Date(),
    });
    await storage().insert(notificationEmailLog).values({
        userId: temporary.userId,
        notificationId,
    });
    await storage().insert(gardenVisitStates).values({
        userId: temporary.userId,
        accountId: temporary.accountId,
        gardenId: temporaryGarden.id,
    });
    await storage().insert(events).values({
        type: 'user.temporary-test',
        version: 1,
        aggregateId: temporary.userId,
        data: null,
    });
    await setUserFavorite({
        userId: temporary.userId,
        entityType: 'plantSort',
        entityId: plantSortId,
        favorited: true,
    });
    await setUserFavorite({
        userId: targetUserId,
        entityType: 'plantSort',
        entityId: plantSortId,
        favorited: true,
    });

    const attached = await attachTemporaryAccountsToUser({
        temporaryUserId: temporary.userId,
        targetUserId,
    });

    assert.deepEqual(attached.accountIds, [temporary.accountId]);

    const movedLink = await storage().query.accountUsers.findFirst({
        where: eq(accountUsers.accountId, temporary.accountId),
    });
    assert.equal(movedLink?.userId, targetUserId);

    const gardens = await getAccountGardensMetadata(temporary.accountId);
    assert.equal(
        gardens.find((garden) => garden.id === playGardenId)?.isSandbox,
        true,
    );
    assert.equal(
        gardens.find((garden) => garden.id !== playGardenId)?.isSandbox,
        false,
    );

    const targetFavorites = await listUserFavorites({ userId: targetUserId });
    assert.deepEqual(
        targetFavorites
            .map((favorite) => `${favorite.entityType}:${favorite.entityId}`)
            .sort(),
        [`plant:${plantId}`, `plantSort:${plantSortId}`].sort(),
    );

    const temporaryFavorites = await listUserFavorites({
        userId: temporary.userId,
    });
    assert.deepEqual(temporaryFavorites, []);

    const deletedTemporaryUser = await storage().query.users.findFirst({
        where: eq(users.id, temporary.userId),
    });
    assert.equal(deletedTemporaryUser, undefined);

    const leftoverLogin = await storage().query.userLogins.findFirst({
        where: eq(userLogins.userId, temporary.userId),
    });
    assert.equal(leftoverLogin, undefined);

    const leftoverRefreshToken = await storage().query.refreshTokens.findFirst({
        where: eq(refreshTokens.userId, temporary.userId),
    });
    assert.equal(leftoverRefreshToken, undefined);

    const movedConversation =
        await storage().query.aiChatConversations.findFirst({
            where: eq(aiChatConversations.id, conversationId),
        });
    assert.equal(movedConversation?.userId, targetUserId);
    const movedUsage = await storage().query.aiUsageLedger.findFirst({
        where: eq(aiUsageLedger.conversationId, conversationId),
    });
    assert.equal(movedUsage?.userId, targetUserId);
    const movedNotification = await storage().query.notifications.findFirst({
        where: eq(notifications.id, notificationId),
    });
    assert.equal(movedNotification?.userId, targetUserId);
    const movedEmailLog = await storage().query.notificationEmailLog.findFirst({
        where: eq(notificationEmailLog.notificationId, notificationId),
    });
    assert.equal(movedEmailLog?.userId, targetUserId);
    const leftoverVisit = await storage().query.gardenVisitStates.findFirst({
        where: eq(gardenVisitStates.userId, temporary.userId),
    });
    assert.equal(leftoverVisit, undefined);
    const leftoverUserEvent = await storage().query.events.findFirst({
        where: eq(events.aggregateId, temporary.userId),
    });
    assert.equal(leftoverUserEvent, undefined);
});

test('createOrUpdateUserPasswordLogin preserves verified login state', async () => {
    createTestDb();
    await ensureFarmId();

    const email = `verified-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(email, 'initial-password');
    const existingLogin = await storage().query.userLogins.findFirst({
        where: eq(userLogins.userId, userId),
    });
    assert.ok(existingLogin);
    const initialLoginData: unknown = JSON.parse(existingLogin.loginData);
    assert.ok(
        typeof initialLoginData === 'object' && initialLoginData !== null,
    );
    await storage()
        .update(userLogins)
        .set({
            loginData: JSON.stringify({
                ...initialLoginData,
                isVerified: true,
            }),
        })
        .where(eq(userLogins.id, existingLogin.id));

    await createOrUpdateUserPasswordLogin(
        userId,
        email,
        'replacement-password',
    );

    const updatedLogin = await storage().query.userLogins.findFirst({
        where: eq(userLogins.id, existingLogin.id),
    });
    assert.ok(updatedLogin);
    const updatedLoginData: unknown = JSON.parse(updatedLogin.loginData);
    assert.ok(
        typeof updatedLoginData === 'object' && updatedLoginData !== null,
    );
    assert.equal(
        'isVerified' in updatedLoginData && updatedLoginData.isVerified,
        true,
    );
});

test('cleanupInactiveTemporaryAccounts deletes stale temporary accounts', async () => {
    createTestDb();
    await ensureFarmId();

    const now = new Date('2026-06-18T12:00:00.000Z');
    const temporary = await createTemporaryUserAndAccount();
    await createRefreshToken(temporary.userId);
    const [temporaryGarden] = await getAccountGardensMetadata(
        temporary.accountId,
    );
    assert.ok(temporaryGarden);
    assert.deepEqual(
        await deleteGardenIfNoActiveRaisedBeds(temporaryGarden.id),
        {
            activeRaisedBedCount: 0,
            deleted: true,
        },
    );
    await storage()
        .update(users)
        .set({ lastActiveAt: new Date('2026-05-01T12:00:00.000Z') })
        .where(eq(users.id, temporary.userId));

    const result = await cleanupInactiveTemporaryAccounts({
        now,
        inactiveDays: 30,
    });

    assert.equal(result.deletedUsers, 1);
    assert.equal(result.deletedAccounts, 1);
    assert.deepEqual(result.failedUserIds, []);

    const deletedTemporaryUser = await storage().query.users.findFirst({
        where: eq(users.id, temporary.userId),
    });
    assert.equal(deletedTemporaryUser, undefined);

    const deletedAccount = await storage().query.accounts.findFirst({
        where: (accounts, { eq }) => eq(accounts.id, temporary.accountId),
    });
    assert.equal(deletedAccount, undefined);

    const deletedGarden = await storage().query.gardens.findFirst({
        where: (gardens, { eq }) => eq(gardens.id, temporaryGarden.id),
    });
    assert.equal(deletedGarden, undefined);
});
