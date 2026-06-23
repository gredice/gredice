import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    attachTemporaryAccountsToUser,
    cleanupInactiveTemporaryAccounts,
    createEntity,
    createOrUpdateUserPasswordLogin,
    createRefreshToken,
    createTemporaryUserAndAccount,
    createUserWithPassword,
    getAccountGardensMetadata,
    getUsersWithBirthdayOn,
    listUserFavorites,
    promoteTemporaryUser,
    refreshTokens,
    setUserFavorite,
    storage,
    upsertEntityType,
    userLogins,
    users,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
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

test('createTemporaryUserAndAccount creates playful temporary user with sandbox garden', async () => {
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
    assert.equal(gardens[0].isSandbox, true);
});

test('promoteTemporaryUser converts a temporary user to email identity', async () => {
    createTestDb();
    await ensureFarmId();

    const temporary = await createTemporaryUserAndAccount();
    await createOrUpdateUserPasswordLogin(
        temporary.userId,
        'promoted-temp@example.com',
        'secret-password',
    );

    await promoteTemporaryUser({
        userId: temporary.userId,
        userName: 'promoted-temp@example.com',
    });

    const user = await storage().query.users.findFirst({
        where: eq(users.id, temporary.userId),
    });
    assert.ok(user);
    assert.equal(user.isTemporary, false);
    assert.equal(user.userName, 'promoted-temp@example.com');

    const login = await storage().query.userLogins.findFirst({
        where: eq(userLogins.userId, temporary.userId),
    });
    assert.equal(login?.loginId, 'promoted-temp@example.com');

    const gardens = await getAccountGardensMetadata(temporary.accountId);
    assert.equal(gardens[0].isSandbox, false);
});

test('attachTemporaryAccountsToUser moves accounts, favorites, and deletes temporary auth rows', async () => {
    createTestDb();
    await ensureFarmId();

    const targetUserId = await createUserWithPassword(
        `target-${randomUUID()}@example.com`,
        'secret-password',
    );
    const temporary = await createTemporaryUserAndAccount();
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
    assert.equal(gardens[0].isSandbox, false);

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
});

test('cleanupInactiveTemporaryAccounts deletes stale temporary accounts', async () => {
    createTestDb();
    await ensureFarmId();

    const now = new Date('2026-06-18T12:00:00.000Z');
    const temporary = await createTemporaryUserAndAccount();
    await createRefreshToken(temporary.userId);
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
});
