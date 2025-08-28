import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount as createAccountDirect,
    getAnalyticsTotals,
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
