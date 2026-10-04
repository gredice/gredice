import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { getAchievementDefinitions } from '@gredice/js/achievements';
import { eq } from 'drizzle-orm';
import {
    accountAchievements,
    accounts,
    accountUsers,
    getAccountUsers,
    getUser,
    getUserAchievementLeaderboard,
    getUsers,
    storage,
    users,
} from '../src';

test('leaderboard and all user projections share approved primary-account scores', async () => {
    const db = storage();
    const keys = getAchievementDefinitions().map(({ key }) => key);
    const ids: string[] = [];
    const accountIds: string[] = [];
    for (let index = 0; index < 13; index++) {
        const id = randomUUID();
        const accountId = randomUUID();
        ids.push(id);
        accountIds.push(accountId);
        await db.insert(users).values({
            id,
            userName: `private-${id}@example.com`,
            displayName: `Vrtlar ${index}`,
            role: 'user',
            isTemporary: index === 12,
            createdAt: new Date(2020, 0, index + 1),
        });
        await db.insert(accounts).values({ id: accountId });
        await db
            .insert(accountUsers)
            .values({ userId: id, accountId, createdAt: new Date(2020, 0, 1) });
        await db.insert(accountAchievements).values(
            keys
                .slice(0, index === 12 ? 34 : 20 - index)
                .map((achievementKey) => ({
                    accountId,
                    achievementKey,
                    status: 'approved' as const,
                })),
        );
    }
    // Pending, denied and unrecognized achievements do not add XP.
    await db.insert(accountAchievements).values([
        {
            accountId: accountIds[0],
            achievementKey: keys[20],
            status: 'pending',
        },
        {
            accountId: accountIds[0],
            achievementKey: keys[21],
            status: 'denied',
        },
        {
            accountId: accountIds[0],
            achievementKey: 'retired_award',
            status: 'approved',
        },
    ]);
    // A second account (even with more awards) cannot inflate this user's score.
    await db.insert(accountUsers).values({
        userId: ids[1],
        accountId: accountIds[12],
        createdAt: new Date(2021, 0, 1),
    });
    // Duplicate memberships cannot double-count awards.
    await db.insert(accountUsers).values({
        userId: ids[0],
        accountId: accountIds[0],
        createdAt: new Date(2021, 0, 1),
    });
    const leaders = await getUserAchievementLeaderboard();
    assert.equal(leaders.length, 10);
    assert.deepEqual(
        leaders.map((user) => user.id),
        ids.slice(0, 10),
    );
    assert.equal(leaders[0].achievementCount, 20);
    assert.ok(!JSON.stringify(leaders).includes('@example.com'));
    assert.equal((await getUser(ids[1]))?.achievementCount, 19);
    assert.equal((await getUser(ids[1]))?.accounts[0].accountId, accountIds[1]);
    assert.equal(
        (await getUsers()).find((user) => user.id === ids[0])?.achievementCount,
        20,
    );
    assert.equal(
        (await getAccountUsers(accountIds[0]))[0].user.achievementCount,
        20,
    );
    // An approval is visible on the next read; no stored XP counter can drift.
    await db
        .update(accountAchievements)
        .set({ status: 'approved' })
        .where(eq(accountAchievements.achievementKey, keys[20]));
    assert.equal((await getUser(ids[0]))?.achievementCount, 21);
    assert.equal(
        (await getUserAchievementLeaderboard())[0].achievementCount,
        21,
    );
    const emptyId = randomUUID();
    await db.insert(users).values({
        id: emptyId,
        userName: `${emptyId}@example.com`,
        role: 'user',
    });
    assert.equal((await getUser(emptyId))?.achievementCount, 0);
    // Shared primary accounts have the same score, with stable registration-order ties.
    await db
        .insert(accountUsers)
        .values({ userId: emptyId, accountId: accountIds[0] });
    const tied = await getUserAchievementLeaderboard();
    assert.deepEqual(
        tied.slice(0, 2).map((user) => user.id),
        [ids[0], emptyId],
    );
    assert.deepEqual(
        tied.slice(0, 2).map((user) => user.achievementCount),
        [21, 21],
    );
});
