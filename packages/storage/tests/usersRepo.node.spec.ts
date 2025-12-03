import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    getUsersWithBirthdayOn,
    storage,
    users,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

const TEST_USER_EMAIL = 'birthday@example.com';

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
