import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAccount,
    createUserWithPassword,
    getGardenVisitState,
    markGardenVisitSummarySeen,
    upsertGardenOpenedAt,
} from '@gredice/storage';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createVisitFixture() {
    createTestDb();

    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const userId = await createUserWithPassword(
        `visit-${randomUUID()}@example.test`,
        'password',
    );

    return { accountId, gardenId, userId };
}

test('getGardenVisitState returns null before the first marker write', async () => {
    const fixture = await createVisitFixture();

    assert.strictEqual(await getGardenVisitState(fixture), null);
});

test('upsertGardenOpenedAt creates and advances the garden opened marker', async () => {
    const fixture = await createVisitFixture();
    const firstOpenedAt = new Date('2026-06-01T08:00:00.000Z');
    const secondOpenedAt = new Date('2026-06-02T09:30:00.000Z');

    const created = await upsertGardenOpenedAt({
        ...fixture,
        openedAt: firstOpenedAt,
    });

    assert.strictEqual(created.userId, fixture.userId);
    assert.strictEqual(created.accountId, fixture.accountId);
    assert.strictEqual(created.gardenId, fixture.gardenId);
    assert.deepStrictEqual(created.lastOpenedAt, firstOpenedAt);
    assert.strictEqual(created.lastSummarySeenAt, null);
    assert.strictEqual(created.lastSummaryFactsHash, null);

    const updated = await upsertGardenOpenedAt({
        ...fixture,
        openedAt: secondOpenedAt,
    });

    assert.strictEqual(updated.id, created.id);
    assert.deepStrictEqual(updated.lastOpenedAt, secondOpenedAt);
    assert.strictEqual(updated.lastSummarySeenAt, null);
});

test('markGardenVisitSummarySeen advances opened and summary markers together', async () => {
    const fixture = await createVisitFixture();
    const openedAt = new Date('2026-06-01T08:00:00.000Z');
    const seenAt = new Date('2026-06-02T10:00:00.000Z');

    const opened = await upsertGardenOpenedAt({
        ...fixture,
        openedAt,
    });
    const seen = await markGardenVisitSummarySeen({
        ...fixture,
        seenAt,
        factsHash: 'growth:12',
    });

    assert.strictEqual(seen.id, opened.id);
    assert.deepStrictEqual(seen.lastOpenedAt, seenAt);
    assert.deepStrictEqual(seen.lastSummarySeenAt, seenAt);
    assert.strictEqual(seen.lastSummaryFactsHash, 'growth:12');
});

test('markGardenVisitSummarySeen creates an empty-summary baseline marker', async () => {
    const fixture = await createVisitFixture();
    const seenAt = new Date('2026-06-02T10:00:00.000Z');

    const seen = await markGardenVisitSummarySeen({
        ...fixture,
        seenAt,
        factsHash: null,
    });

    assert.strictEqual(seen.userId, fixture.userId);
    assert.strictEqual(seen.accountId, fixture.accountId);
    assert.strictEqual(seen.gardenId, fixture.gardenId);
    assert.deepStrictEqual(seen.lastOpenedAt, seenAt);
    assert.deepStrictEqual(seen.lastSummarySeenAt, seenAt);
    assert.strictEqual(seen.lastSummaryFactsHash, null);
});

test('garden visit markers are isolated by user within a shared account garden', async () => {
    const fixture = await createVisitFixture();
    const secondUserId = await createUserWithPassword(
        `visit-${randomUUID()}@example.test`,
        'password',
    );
    const firstSeenAt = new Date('2026-06-02T10:00:00.000Z');
    const secondSeenAt = new Date('2026-06-03T10:00:00.000Z');

    await markGardenVisitSummarySeen({
        ...fixture,
        seenAt: firstSeenAt,
        factsHash: 'first-user',
    });
    await markGardenVisitSummarySeen({
        ...fixture,
        userId: secondUserId,
        seenAt: secondSeenAt,
        factsHash: 'second-user',
    });

    const firstState = await getGardenVisitState(fixture);
    const secondState = await getGardenVisitState({
        ...fixture,
        userId: secondUserId,
    });

    assert.deepStrictEqual(firstState?.lastSummarySeenAt, firstSeenAt);
    assert.strictEqual(firstState?.lastSummaryFactsHash, 'first-user');
    assert.deepStrictEqual(secondState?.lastSummarySeenAt, secondSeenAt);
    assert.strictEqual(secondState?.lastSummaryFactsHash, 'second-user');
});

test('garden visit markers are isolated by garden', async () => {
    const fixture = await createVisitFixture();
    const farmId = await ensureFarmId();
    const otherGardenId = await createTestGarden({
        accountId: fixture.accountId,
        farmId,
    });
    const seenAt = new Date('2026-06-02T10:00:00.000Z');

    await markGardenVisitSummarySeen({
        ...fixture,
        seenAt,
        factsHash: 'first-garden',
    });

    assert.strictEqual(
        await getGardenVisitState({
            ...fixture,
            gardenId: otherGardenId,
        }),
        null,
    );
});
