import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    createAccount,
    createGarden,
    gardens,
    getUserDefaultGarden,
    setUserDefaultGarden,
    UserDefaultGardenNotAccessibleError,
    UserDefaultGardenSandboxError,
    users,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createUserFixture(accountCount = 1) {
    const db = createTestDb();
    const userId = randomUUID();
    const now = new Date();

    await db.insert(users).values({
        id: userId,
        userName: `default-garden-${userId}@example.test`,
        role: 'user',
        createdAt: now,
        updatedAt: now,
    });

    const accountIds: string[] = [];
    for (let index = 0; index < accountCount; index += 1) {
        const accountId = await createAccount();
        accountIds.push(accountId);
        await db.insert(accountUsers).values({
            accountId,
            userId,
            createdAt: now,
            updatedAt: now,
        });
    }

    return {
        accountIds,
        db,
        farmId: await ensureFarmId(),
        userId,
    };
}

test('stores an accessible real garden from another user account as the default', async () => {
    const fixture = await createUserFixture(2);
    const targetAccountId = fixture.accountIds[1];
    assert.ok(targetAccountId);
    const gardenId = await createGarden({
        accountId: targetAccountId,
        farmId: fixture.farmId,
        name: 'Secondary account garden',
    });

    const selected = await setUserDefaultGarden({
        gardenId,
        userId: fixture.userId,
    });

    assert.equal(selected.id, gardenId);
    assert.equal(selected.accountId, targetAccountId);
    assert.equal((await getUserDefaultGarden(fixture.userId))?.id, gardenId);
    assert.equal(
        (
            await fixture.db.query.users.findFirst({
                where: eq(users.id, fixture.userId),
            })
        )?.defaultGardenId,
        gardenId,
    );
});

test('keeps the default garden isolated per user on a shared account', async () => {
    const fixture = await createUserFixture();
    const accountId = fixture.accountIds[0];
    assert.ok(accountId);
    const secondUserId = randomUUID();
    const now = new Date();
    await fixture.db.insert(users).values({
        id: secondUserId,
        userName: `default-garden-${secondUserId}@example.test`,
        role: 'user',
        createdAt: now,
        updatedAt: now,
    });
    await fixture.db.insert(accountUsers).values({
        accountId,
        userId: secondUserId,
        createdAt: now,
        updatedAt: now,
    });
    const gardenId = await createGarden({
        accountId,
        farmId: fixture.farmId,
        name: 'Shared account garden',
    });

    await setUserDefaultGarden({ gardenId, userId: fixture.userId });

    assert.equal((await getUserDefaultGarden(fixture.userId))?.id, gardenId);
    assert.equal(await getUserDefaultGarden(secondUserId), null);
});

test('rejects a garden from an account the user cannot access', async () => {
    const fixture = await createUserFixture();
    const inaccessibleAccountId = await createAccount();
    const gardenId = await createGarden({
        accountId: inaccessibleAccountId,
        farmId: fixture.farmId,
        name: 'Inaccessible garden',
    });

    await assert.rejects(
        () =>
            setUserDefaultGarden({
                gardenId,
                userId: fixture.userId,
            }),
        (error: unknown) => {
            assert.ok(error instanceof UserDefaultGardenNotAccessibleError);
            assert.equal(error.gardenId, gardenId);
            return true;
        },
    );
    assert.equal(await getUserDefaultGarden(fixture.userId), null);
});

test('rejects an accessible sandbox garden', async () => {
    const fixture = await createUserFixture();
    const accountId = fixture.accountIds[0];
    assert.ok(accountId);
    const gardenId = await createGarden({
        accountId,
        farmId: fixture.farmId,
        isSandbox: true,
        name: 'Sandbox garden',
    });

    await assert.rejects(
        () =>
            setUserDefaultGarden({
                gardenId,
                userId: fixture.userId,
            }),
        (error: unknown) => {
            assert.ok(error instanceof UserDefaultGardenSandboxError);
            assert.equal(error.gardenId, gardenId);
            return true;
        },
    );
    assert.equal(await getUserDefaultGarden(fixture.userId), null);
});

test('rejects a soft-deleted garden', async () => {
    const fixture = await createUserFixture();
    const accountId = fixture.accountIds[0];
    assert.ok(accountId);
    const gardenId = await createGarden({
        accountId,
        farmId: fixture.farmId,
        name: 'Deleted garden',
    });
    await fixture.db
        .update(gardens)
        .set({ isDeleted: true })
        .where(eq(gardens.id, gardenId));

    await assert.rejects(
        () =>
            setUserDefaultGarden({
                gardenId,
                userId: fixture.userId,
            }),
        (error: unknown) => {
            assert.ok(error instanceof UserDefaultGardenNotAccessibleError);
            assert.equal(error.gardenId, gardenId);
            return true;
        },
    );
});

test('does not return a stored default after the user loses account access', async () => {
    const fixture = await createUserFixture();
    const accountId = fixture.accountIds[0];
    assert.ok(accountId);
    const gardenId = await createGarden({
        accountId,
        farmId: fixture.farmId,
        name: 'Formerly accessible garden',
    });
    await setUserDefaultGarden({ gardenId, userId: fixture.userId });

    await fixture.db
        .delete(accountUsers)
        .where(
            and(
                eq(accountUsers.accountId, accountId),
                eq(accountUsers.userId, fixture.userId),
            ),
        );

    assert.equal(await getUserDefaultGarden(fixture.userId), null);
    assert.equal(
        (
            await fixture.db.query.users.findFirst({
                where: eq(users.id, fixture.userId),
            })
        )?.defaultGardenId,
        gardenId,
    );
});

test('does not return a stored default after the garden is soft-deleted', async () => {
    const fixture = await createUserFixture();
    const accountId = fixture.accountIds[0];
    assert.ok(accountId);
    const gardenId = await createGarden({
        accountId,
        farmId: fixture.farmId,
        name: 'Soft-deleted default garden',
    });
    await setUserDefaultGarden({ gardenId, userId: fixture.userId });

    await fixture.db
        .update(gardens)
        .set({ isDeleted: true })
        .where(eq(gardens.id, gardenId));

    assert.equal(await getUserDefaultGarden(fixture.userId), null);
});

test('clears the stored default when the garden is hard-deleted', async () => {
    const fixture = await createUserFixture();
    const accountId = fixture.accountIds[0];
    assert.ok(accountId);
    const gardenId = await createGarden({
        accountId,
        farmId: fixture.farmId,
        name: 'Hard-deleted default garden',
    });
    await setUserDefaultGarden({ gardenId, userId: fixture.userId });

    await fixture.db.delete(gardens).where(eq(gardens.id, gardenId));

    assert.equal(
        (
            await fixture.db.query.users.findFirst({
                where: eq(users.id, fixture.userId),
            })
        )?.defaultGardenId,
        null,
    );
});
