import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { gardenPackProductSnapshotSchema } from '../src/gardenPackContract';
import {
    AccountDeletionInProgressError,
    markAccountDeletionStarted,
} from '../src/repositories/accountDeletionFenceRepo';
import {
    GardenPackConflictError,
    GardenPackNotFoundError,
    getPurchasedGardenPack,
    getPurchasedGardenPackAudit,
    listPurchasedGardenPacks,
    recordPurchasedGardenPack,
    transitionPurchasedGardenPackUnit,
} from '../src/repositories/gardenPacksRepo';
import * as schema from '../src/schema';
import { gardenPackIntegritySql } from '../src/schema/gardenPackIntegrity';
import * as packSchema from '../src/schema/gardenPackSchema';

function databaseFailure(expected: RegExp) {
    return (error: unknown) => {
        assert.ok(error instanceof Error);
        let cause = error;
        while (cause.cause instanceof Error) cause = cause.cause;
        assert.match(cause.message, expected);
        return true;
    };
}

const client = new PGlite();
const db = drizzle(client, { schema });
// Generate DDL from source: shared PRs deliberately exclude deployment migrations.
before(async () => {
    const statements = await generateMigration(
        generateDrizzleJson({}),
        generateDrizzleJson({
            accounts: schema.accounts,
            events: schema.events,
            farms: schema.farms,
            gardens: schema.gardens,
            ...packSchema,
        }),
    );
    await client.exec(statements.join('\n'));
    await client.exec(gardenPackIntegritySql);
});
after(() => client.close());

function snapshot() {
    return gardenPackProductSnapshotSchema.parse({
        contractVersion: 1,
        productId: 'test-pack',
        productVersionId: `test-pack:${randomUUID()}`,
        name: { hr: 'Probni paket' },
        description: { hr: 'Samo testni primjer.' },
        previews: ['https://example.test/pack.webp'],
        currency: 'sunflower',
        chargedSunflowers: 11,
        publication: 'published',
        availableFrom: null,
        availableUntil: '2026-01-01T00:00:00Z',
        policy: {
            versionId: 'policy:v1',
            refunds: 'unused-units-paid-value',
            recycling: 'configured-per-unit-value',
            seasonExpiry: 'retain-owned-units',
            gardenDeletion: 'recycle-placed-units-once',
            accountDeletion: 'detach-owner-retain-audit',
        },
        lines: [
            {
                lineId: 'pumpkins',
                entityId: '123',
                modelName: 'TestPumpkin',
                variant: {
                    versionId: 'appearance:v1',
                    appearance: { color: 'orange' },
                },
                quantity: 2,
                paidSunflowersByUnit: [5, 6],
                recyclingSunflowersByUnit: [2, 3],
            },
        ],
    });
}
async function fixture() {
    const accountId = randomUUID();
    await db.insert(schema.accounts).values({ id: accountId });
    const product = snapshot();
    const grant = await db.transaction((tx) =>
        recordPurchasedGardenPack(accountId, randomUUID(), product, tx),
    );
    return { accountId, product, purchaseId: grant.purchaseId };
}
async function garden(accountId: string, isSandbox = false) {
    const [farm] = await db
        .insert(schema.farms)
        .values({ name: 'Test farm', latitude: 0, longitude: 0 })
        .returning();
    assert.ok(farm);
    const [garden] = await db
        .insert(schema.gardens)
        .values({ accountId, farmId: farm.id, name: 'Test garden', isSandbox })
        .returning();
    assert.ok(garden);
    return garden.id;
}

function unitCommand(purchaseId: string, unitOrdinal = 1) {
    return {
        purchaseId,
        lineId: 'pumpkins',
        unitOrdinal,
        operationId: randomUUID(),
    };
}

test('snapshot survives season expiry, reload, and changed caller data; account reads isolate inventory and audit', async () => {
    const { accountId, purchaseId, product } = await fixture();
    const outsider = randomUUID();
    product.lines[0]?.paidSunflowersByUnit.splice(0, 1, 99);
    const owned = await getPurchasedGardenPack(accountId, purchaseId, db);
    assert.equal(owned?.state, 'unopened');
    assert.equal(owned?.remainingQuantity, 2);
    assert.deepEqual(owned?.snapshot.lines[0]?.paidSunflowersByUnit, [5, 6]);
    assert.equal(
        await getPurchasedGardenPack(outsider, purchaseId, db),
        undefined,
    );
    assert.deepEqual(await listPurchasedGardenPacks(outsider, {}, db), []);
    assert.deepEqual(
        await getPurchasedGardenPackAudit(outsider, purchaseId, db),
        [],
    );
    await assert.rejects(() =>
        db.transaction((tx) =>
            transitionPurchasedGardenPackUnit(
                outsider,
                { ...unitCommand(purchaseId), kind: 'refunded' },
                tx,
            ),
        ),
    );
    assert.equal((await listPurchasedGardenPacks(accountId, {}, db)).length, 1);
});

test('purchase retry is idempotent, repeats grant quantities and version reuse cannot rewrite contents across accounts', async () => {
    const accountId = randomUUID();
    const other = randomUUID();
    await db.insert(schema.accounts).values([{ id: accountId }, { id: other }]);
    const product = snapshot();
    const operation = randomUUID();
    const [first, retry] = await Promise.all(
        [1, 2].map(() =>
            db.transaction((tx) =>
                recordPurchasedGardenPack(accountId, operation, product, tx),
            ),
        ),
    );
    assert.equal(first?.purchaseId, retry?.purchaseId);
    assert.deepEqual([first?.replayed, retry?.replayed], [false, true]);
    await db.transaction((tx) =>
        recordPurchasedGardenPack(accountId, randomUUID(), product, tx),
    );
    assert.equal((await listPurchasedGardenPacks(accountId, {}, db)).length, 2);
    const changed = { ...product, name: { hr: 'Promijenjeno' } };
    await assert.rejects(
        () =>
            db.transaction((tx) =>
                recordPurchasedGardenPack(accountId, operation, changed, tx),
            ),
        GardenPackConflictError,
    );
    await assert.rejects(
        () =>
            db.transaction((tx) =>
                recordPurchasedGardenPack(other, randomUUID(), changed, tx),
            ),
        GardenPackConflictError,
    );
});

test('concurrent consumption cannot overdraw; retries, partial refunds and once-only recycling preserve exact values', async () => {
    const { accountId, purchaseId } = await fixture();
    const gardenId = await garden(accountId);
    const placed = {
        ...unitCommand(purchaseId),
        kind: 'placed',
        gardenId,
        blockId: randomUUID(),
    } satisfies Parameters<typeof transitionPurchasedGardenPackUnit>[1];
    const result = await db.transaction((tx) =>
        transitionPurchasedGardenPackUnit(accountId, placed, tx),
    );
    assert.equal(result.event.creditedSunflowers, 0);
    assert.equal(
        (
            await db.transaction((tx) =>
                transitionPurchasedGardenPackUnit(accountId, placed, tx),
            )
        ).replayed,
        true,
    );
    assert.equal(
        (await getPurchasedGardenPack(accountId, purchaseId, db))?.state,
        'partially-used',
    );
    const outcomes = await Promise.allSettled(
        [1, 2].map(() =>
            db.transaction((tx) =>
                transitionPurchasedGardenPackUnit(
                    accountId,
                    { ...unitCommand(purchaseId, 2), kind: 'refunded' },
                    tx,
                ),
            ),
        ),
    );
    assert.equal(
        outcomes.filter((result) => result.status === 'fulfilled').length,
        1,
    );
    const audit = await getPurchasedGardenPackAudit(accountId, purchaseId, db);
    assert.equal(
        audit.find((event) => event.kind === 'refunded')?.creditedSunflowers,
        6,
    );
    await assert.rejects(
        () =>
            db.transaction((tx) =>
                transitionPurchasedGardenPackUnit(
                    accountId,
                    { ...unitCommand(purchaseId), kind: 'refunded' },
                    tx,
                ),
            ),
        GardenPackConflictError,
    );
    const recycled = await db.transaction((tx) =>
        transitionPurchasedGardenPackUnit(
            accountId,
            { ...unitCommand(purchaseId), kind: 'recycled' },
            tx,
        ),
    );
    assert.equal(recycled.event.creditedSunflowers, 2);
    await assert.rejects(
        () =>
            db.transaction((tx) =>
                transitionPurchasedGardenPackUnit(
                    accountId,
                    { ...unitCommand(purchaseId), kind: 'recycled' },
                    tx,
                ),
            ),
        GardenPackConflictError,
    );
    assert.equal(
        (await getPurchasedGardenPack(accountId, purchaseId, db))?.state,
        'exhausted',
    );
});

test('unit operation identity is account-scoped across packs and cannot reuse one block provenance', async () => {
    const { accountId, purchaseId, product } = await fixture();
    const second = await db.transaction((tx) =>
        recordPurchasedGardenPack(accountId, randomUUID(), product, tx),
    );
    const gardenId = await garden(accountId);
    const operationId = randomUUID();
    const blockId = randomUUID();
    await db.transaction((tx) =>
        transitionPurchasedGardenPackUnit(
            accountId,
            {
                ...unitCommand(purchaseId),
                operationId,
                kind: 'placed',
                gardenId,
                blockId,
            },
            tx,
        ),
    );
    await assert.rejects(
        () =>
            db.transaction((tx) =>
                transitionPurchasedGardenPackUnit(
                    accountId,
                    {
                        ...unitCommand(second.purchaseId),
                        operationId,
                        kind: 'placed',
                        gardenId,
                        blockId: randomUUID(),
                    },
                    tx,
                ),
            ),
        GardenPackConflictError,
    );
    await assert.rejects(() =>
        db.transaction((tx) =>
            transitionPurchasedGardenPackUnit(
                accountId,
                {
                    ...unitCommand(second.purchaseId),
                    kind: 'placed',
                    gardenId,
                    blockId,
                },
                tx,
            ),
        ),
    );
    assert.equal(
        (await getPurchasedGardenPack(accountId, second.purchaseId, db))
            ?.remainingQuantity,
        2,
    );
});

test('ordinary garden ownership, deletion fence and rollback protect future placement/purchase atomicity', async () => {
    const { accountId, purchaseId, product } = await fixture();
    const sandbox = await garden(accountId, true);
    await assert.rejects(
        () =>
            db.transaction((tx) =>
                transitionPurchasedGardenPackUnit(
                    accountId,
                    {
                        ...unitCommand(purchaseId),
                        kind: 'placed',
                        gardenId: sandbox,
                        blockId: 'block',
                    },
                    tx,
                ),
            ),
        GardenPackNotFoundError,
    );
    await assert.rejects(
        () =>
            db.transaction(async (tx) => {
                await transitionPurchasedGardenPackUnit(
                    accountId,
                    { ...unitCommand(purchaseId), kind: 'refunded' },
                    tx,
                );
                throw new Error('Simulated wallet failure');
            }),
        /Simulated wallet failure/,
    );
    assert.equal(
        (await getPurchasedGardenPack(accountId, purchaseId, db))
            ?.remainingQuantity,
        2,
    );
    assert.deepEqual(
        await getPurchasedGardenPackAudit(accountId, purchaseId, db),
        [],
    );
    await db.transaction((tx) => markAccountDeletionStarted(accountId, tx));
    await assert.rejects(
        () =>
            db.transaction((tx) =>
                recordPurchasedGardenPack(accountId, randomUUID(), product, tx),
            ),
        AccountDeletionInProgressError,
    );
    await assert.rejects(
        () =>
            db.transaction((tx) =>
                transitionPurchasedGardenPackUnit(
                    accountId,
                    { ...unitCommand(purchaseId), kind: 'refunded' },
                    tx,
                ),
            ),
        AccountDeletionInProgressError,
    );
});

test('account deletion detaches ownership but retains immutable purchase and audit; garden soft deletion leaves unused inventory', async () => {
    const { accountId, purchaseId } = await fixture();
    const gardenId = await garden(accountId);
    await db
        .update(schema.gardens)
        .set({ isDeleted: true })
        .where(eq(schema.gardens.id, gardenId));
    assert.equal(
        (await getPurchasedGardenPack(accountId, purchaseId, db))
            ?.remainingQuantity,
        2,
    );
    await db.transaction((tx) =>
        transitionPurchasedGardenPackUnit(
            accountId,
            { ...unitCommand(purchaseId), kind: 'refunded' },
            tx,
        ),
    );
    // Existing deletion workflow removes gardens before deleting the account.
    await db.delete(schema.gardens).where(eq(schema.gardens.id, gardenId));
    await db.delete(schema.accounts).where(eq(schema.accounts.id, accountId));
    assert.equal(
        await getPurchasedGardenPack(accountId, purchaseId, db),
        undefined,
    );
    const [retained] = await db
        .select()
        .from(schema.gardenPackPurchases)
        .where(eq(schema.gardenPackPurchases.id, purchaseId));
    assert.equal(retained?.accountId, null);
    assert.equal(
        (
            await db
                .select()
                .from(schema.gardenPackUnitEvents)
                .where(eq(schema.gardenPackUnitEvents.purchaseId, purchaseId))
        ).length,
        1,
    );
    await assert.rejects(() =>
        db
            .update(schema.gardenPackPurchases)
            .set({ accountId: randomUUID() })
            .where(eq(schema.gardenPackPurchases.id, purchaseId)),
    );
});

test('database rejects immutable changes, overdraw, invalid provenance, unaudited transitions and incorrect credits', async () => {
    const { accountId, purchaseId, product } = await fixture();
    const unitWhere = and(
        eq(schema.gardenPackUnits.purchaseId, purchaseId),
        eq(schema.gardenPackUnits.unitOrdinal, 1),
    );
    await assert.rejects(
        () =>
            db
                .update(schema.gardenPackPurchases)
                .set({ snapshot: { ...product, name: { hr: 'Changed' } } })
                .where(eq(schema.gardenPackPurchases.id, purchaseId)),
        databaseFailure(/immutable/),
    );
    await assert.rejects(
        () =>
            db
                .update(schema.gardenPackProductVersions)
                .set({ snapshot: { ...product, name: { hr: 'Changed' } } })
                .where(
                    eq(
                        schema.gardenPackProductVersions.id,
                        product.productVersionId,
                    ),
                ),
        databaseFailure(/immutable/),
    );
    await assert.rejects(() =>
        db
            .update(schema.gardenPackUnits)
            .set({ unitOrdinal: 0 })
            .where(unitWhere),
    );
    await assert.rejects(
        () =>
            db
                .update(schema.gardenPackUnits)
                .set({ paidSunflowers: 100 })
                .where(unitWhere),
        databaseFailure(/immutable/),
    );
    await assert.rejects(
        () =>
            db
                .update(schema.gardenPackUnits)
                .set({ state: 'refunded' })
                .where(unitWhere),
        databaseFailure(/matching audit/),
    );
    for (const provenance of [
        { gardenId: null, blockId: null },
        { gardenId: 1, blockId: null },
        { gardenId: null, blockId: 'block' },
    ]) {
        await assert.rejects(() =>
            db
                .update(schema.gardenPackUnits)
                .set({ state: 'placed', ...provenance })
                .where(unitWhere),
        );
        await assert.rejects(() =>
            db.insert(schema.gardenPackUnitEvents).values({
                id: randomUUID(),
                accountId,
                purchaseId,
                lineId: 'pumpkins',
                unitOrdinal: 1,
                operationId: randomUUID(),
                kind: 'placed',
                creditedSunflowers: 0,
                ...provenance,
            }),
        );
    }
    await assert.rejects(
        () =>
            db.insert(schema.gardenPackUnitEvents).values({
                id: randomUUID(),
                accountId,
                purchaseId,
                lineId: 'pumpkins',
                unitOrdinal: 1,
                operationId: randomUUID(),
                kind: 'refunded',
                creditedSunflowers: 10,
            }),
        databaseFailure(/original allocation/),
    );
    await assert.rejects(
        () =>
            db
                .delete(schema.gardenPackPurchases)
                .where(eq(schema.gardenPackPurchases.id, purchaseId)),
        databaseFailure(/immutable/),
    );
});

test('database forbids conflicting consume/refund audit and recycling without a placement event', async () => {
    const { accountId, purchaseId } = await fixture();
    const base = { accountId, purchaseId, lineId: 'pumpkins', unitOrdinal: 1 };
    await assert.rejects(
        () =>
            db.transaction(async (tx) => {
                await tx.insert(schema.gardenPackUnitEvents).values({
                    ...base,
                    id: randomUUID(),
                    operationId: randomUUID(),
                    kind: 'placed',
                    creditedSunflowers: 0,
                    gardenId: 1,
                    blockId: 'block',
                });
                await tx.insert(schema.gardenPackUnitEvents).values({
                    ...base,
                    id: randomUUID(),
                    operationId: randomUUID(),
                    kind: 'refunded',
                    creditedSunflowers: 5,
                });
                await tx
                    .update(schema.gardenPackUnits)
                    .set({ state: 'refunded' })
                    .where(
                        and(
                            eq(schema.gardenPackUnits.purchaseId, purchaseId),
                            eq(schema.gardenPackUnits.unitOrdinal, 1),
                        ),
                    );
            }),
        databaseFailure(/valid prior audit/),
    );
    await assert.rejects(
        () =>
            db.transaction(async (tx) => {
                const unitWhere = and(
                    eq(schema.gardenPackUnits.purchaseId, purchaseId),
                    eq(schema.gardenPackUnits.unitOrdinal, 1),
                );
                await tx
                    .update(schema.gardenPackUnits)
                    .set({ state: 'placed', gardenId: 1, blockId: 'block' })
                    .where(unitWhere);
                await tx.insert(schema.gardenPackUnitEvents).values({
                    ...base,
                    id: randomUUID(),
                    operationId: randomUUID(),
                    kind: 'recycled',
                    creditedSunflowers: 2,
                    gardenId: 1,
                    blockId: 'block',
                });
                await tx
                    .update(schema.gardenPackUnits)
                    .set({ state: 'recycled' })
                    .where(unitWhere);
            }),
        databaseFailure(/valid prior audit/),
    );
});

test('database rejects mismatched charged totals, missing quantities, null identity scalars and incomplete exact grants', async () => {
    const accountId = randomUUID();
    await db.insert(schema.accounts).values({ id: accountId });
    async function rawGrant(
        product: unknown,
        values: { quantity?: number; price?: number } = {},
    ) {
        const purchaseId = randomUUID();
        const productVersionId = `test:${randomUUID()}`;
        const raw = { ...snapshot(), productVersionId, ...Object(product) };
        await db.transaction(async (tx) => {
            await tx.execute(
                sql`INSERT INTO garden_pack_product_versions (id, snapshot) VALUES (${productVersionId}, ${JSON.stringify(raw)}::jsonb)`,
            );
            await tx.execute(
                sql`INSERT INTO garden_pack_purchases (id, account_id, operation_id, product_id, product_version_id, contract_version, charged_sunflowers, snapshot) VALUES (${purchaseId}, ${accountId}, ${randomUUID()}, ${raw.productId}, ${productVersionId}, 1, ${values.price ?? 11}, ${JSON.stringify(raw)}::jsonb)`,
            );
            for (let index = 0; index < (values.quantity ?? 2); index++)
                await tx.insert(schema.gardenPackUnits).values({
                    purchaseId,
                    lineId: 'pumpkins',
                    unitOrdinal: index + 1,
                    paidSunflowers: [5, 6][index] ?? 0,
                    recyclingSunflowers: [2, 3][index] ?? 0,
                });
        });
    }
    await assert.rejects(
        () => rawGrant({}, { quantity: 1 }),
        /allocation mismatch/,
    );
    await assert.rejects(
        () => rawGrant({ chargedSunflowers: 12 }, { price: 12 }),
        /allocation mismatch/,
    );
    for (const field of [
        'productId',
        'chargedSunflowers',
        'contractVersion',
        'currency',
    ])
        await assert.rejects(() => rawGrant({ [field]: null }));
    const extraLine = {
        lineId: 'broken',
        entityId: '124',
        quantity: null,
        paidSunflowersByUnit: [],
        recyclingSunflowersByUnit: [],
    };
    await assert.rejects(
        () => rawGrant({ lines: [...snapshot().lines, extraLine] }),
        /quantities/,
    );
});
