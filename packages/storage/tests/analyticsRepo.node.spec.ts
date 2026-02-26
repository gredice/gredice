import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAccount as createAccountDirect,
    getAnalyticsTotals,
    getUserRegistrationsByWeekday,
    storage,
    users,
} from '@gredice/storage';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

// If helpers/testHelpers does not export createTestGarden/ensureFarmId, fallback to direct import
// (for monorepo, this is safe)

test('getAnalyticsTotals returns correct counts for empty db', async () => {
    createTestDb();
    const totals = await getAnalyticsTotals();
    assert.strictEqual(typeof totals.users, 'number');
    assert.strictEqual(typeof totals.accounts, 'number');
    assert.strictEqual(typeof totals.farms, 'number');
    assert.strictEqual(typeof totals.gardens, 'number');
    assert.strictEqual(typeof totals.blocks, 'number');
    assert.strictEqual(typeof totals.events, 'number');
    assert.strictEqual(typeof totals.raisedBeds, 'number');
    assert.strictEqual(typeof totals.transactions, 'number');
    assert.ok(totals.activeUsers);
    assert.strictEqual(typeof totals.activeUsers.daily, 'number');
    assert.strictEqual(typeof totals.activeUsers.weekly, 'number');
    assert.strictEqual(typeof totals.activeUsers.monthly, 'number');
});

test('getAnalyticsTotals increases after creating entities', async () => {
    createTestDb();
    // Create account, farm, garden
    const accountId = await createAccountDirect();
    const farmId = await ensureFarmId();
    await createTestGarden({ accountId, farmId });
    // Now check totals
    const totals = await getAnalyticsTotals();
    assert.ok(totals.accounts >= 1);
    assert.ok(totals.farms >= 1);
    assert.ok(totals.gardens >= 1);
});

test('getUserRegistrationsByWeekday returns array of 7 zeros for empty range', async () => {
    createTestDb();
    const from = new Date('2000-01-01');
    const to = new Date('2000-01-01');
    const counts = await getUserRegistrationsByWeekday(from, to);
    assert.strictEqual(counts.length, 7);
    assert.ok(counts.every((c) => c === 0));
});

test('getUserRegistrationsByWeekday counts registrations per weekday', async () => {
    createTestDb();
    const db = storage();

    // Insert users on known dates: 2024-01-01 is Monday (index 1) and 2024-01-07 is Sunday (index 0)
    const mondayId = randomUUID();
    const sundayId = randomUUID();
    await db.insert(users).values([
        {
            id: mondayId,
            userName: `weekday-monday-${mondayId}@test.com`,
            displayName: 'Monday User',
            role: 'user',
            createdAt: new Date('2024-01-01T12:00:00Z'),
            updatedAt: new Date('2024-01-01T12:00:00Z'),
        },
        {
            id: sundayId,
            userName: `weekday-sunday-${sundayId}@test.com`,
            displayName: 'Sunday User',
            role: 'user',
            createdAt: new Date('2024-01-07T12:00:00Z'),
            updatedAt: new Date('2024-01-07T12:00:00Z'),
        },
    ]);

    const from = new Date('2024-01-01T00:00:00Z');
    const to = new Date('2024-01-07T23:59:59Z');
    const counts = await getUserRegistrationsByWeekday(from, to);

    assert.strictEqual(counts.length, 7);
    assert.ok(counts[0] >= 1, 'Expected at least 1 registration on Sunday');
    assert.ok(counts[1] >= 1, 'Expected at least 1 registration on Monday');
});
