import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { BlockData } from '@gredice/directory-types';
import {
    type GardenPackTransaction,
    getGardenPackInventoryPage,
    getGardenPackInventoryPurchase,
    getGardenPackPurchaseByOperation,
    getSunflowers,
    isGardenPackStorageReady,
    markAccountDeletionStarted,
    recordPurchasedGardenPack,
    spendSunflowersBatch,
    withAccountDeletionFenceTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { gardenPackProductSnapshotSchema } from '@gredice/storage/gardenPackContract';
import {
    gardenPackIntegritySql,
    getGardenPackTestDdl,
    schema,
} from '@gredice/storage/testing/gardenPackTestSchema';
import { eq, sql } from 'drizzle-orm';
import { drizzle as nodeDrizzle } from 'drizzle-orm/node-postgres';
import { drizzle as pgliteDrizzle } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { assertGardenPackPurchaseContents } from './gardenPackEligibility';
import {
    createGardenPackPurchaseService,
    type GardenPackPurchaseDependencies,
} from './gardenPackPurchaseService';

const adminUrl = process.env.GREDICE_PACK_TEST_ADMIN_URL;
const databaseName = `gredice_pack_purchase_${randomUUID().replaceAll('-', '')}`;
const memory = new PGlite();
const memoryDb = pgliteDrizzle(memory, { schema });
let pool:
    | { end(): Promise<void>; query(query: string): Promise<unknown> }
    | undefined;
let adminPool: typeof pool;
let db: typeof memoryDb | ReturnType<typeof nodeDrizzle<typeof schema>> =
    memoryDb;

before(async () => {
    const statements = await getGardenPackTestDdl();
    if (adminUrl) {
        const url = new URL(adminUrl);
        assert.ok(
            ['127.0.0.1', 'localhost'].includes(url.hostname),
            'Only a local disposable PostgreSQL cluster is allowed',
        );
        assert.equal(url.username, 'packtest');
        assert.equal(url.pathname, '/postgres');
        adminPool = new Pool({ connectionString: adminUrl, max: 1 });
        assert.ok(adminPool);
        await adminPool.query(`CREATE DATABASE "${databaseName}"`);
        url.pathname = `/${databaseName}`;
        const driver = new Pool({ connectionString: url.toString(), max: 8 });
        pool = driver;
        db = nodeDrizzle(driver, { schema });
        await driver.query(statements.join('\n'));
        await driver.query(gardenPackIntegritySql);
    } else {
        await memory.exec(statements.join('\n'));
        await memory.exec(gardenPackIntegritySql);
    }
});
after(async () => {
    await pool?.end();
    if (adminPool) {
        await adminPool.query(
            `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
        );
        await adminPool.end();
    }
    await memory.close();
});

function product() {
    return gardenPackProductSnapshotSchema.parse({
        contractVersion: 1,
        productId: 'test-pack',
        productVersionId: `test-pack:${randomUUID()}`,
        name: { hr: 'Probni paket' },
        description: { hr: 'Testni primjer, bez prodajne konfiguracije.' },
        previews: ['https://example.test/pack.webp'],
        currency: 'sunflower',
        chargedSunflowers: 11,
        publication: 'published',
        availableFrom: null,
        availableUntil: null,
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
                modelName: 'HarvestPumpkinSquatOrange',
                variant: null,
                quantity: 2,
                paidSunflowersByUnit: [5, 6],
                recyclingSunflowersByUnit: [2, 3],
            },
        ],
    });
}
function block(overrides: Partial<BlockData> = {}): BlockData {
    return {
        id: 123,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: 'test-pumpkin',
        information: {
            name: 'HarvestPumpkinSquatOrange',
            label: 'Test',
            shortDescription: '',
            fullDescription: '',
        },
        attributes: {
            type: 'decoration',
            height: 1,
            stackable: false,
            nightOnlyPurchase: false,
        },
        functions: { raisedBed: false, recycler: false },
        prices: { sunflowers: 10 },
        createdAt: '2026-10-02T00:00:00Z',
        updatedAt: '2026-10-02T00:00:00Z',
        ...overrides,
    };
}
async function fixture(balance = 100) {
    const accountId = randomUUID();
    await db.insert(schema.accounts).values({ id: accountId });
    await db.insert(schema.events).values({
        aggregateId: accountId,
        type: 'account.earnSunflowers',
        version: 1,
        data: { amount: balance, reason: 'test-only' },
    });
    const snapshot = product();
    const backendPids = new Set<number>();
    const dependencies: GardenPackPurchaseDependencies<GardenPackTransaction> =
        {
            isStorageEnabled: () => true,
            isSalesEnabled: () => true,
            isStorageReady: () => isGardenPackStorageReady(db),
            withAccountTransaction: (accountId, callback) =>
                db.transaction(async (tx) => {
                    if (adminUrl) {
                        const [backend] = await tx
                            .select({ pid: sql<number>`pg_backend_pid()` })
                            .from(schema.accounts)
                            .where(eq(schema.accounts.id, accountId));
                        if (backend) backendPids.add(backend.pid);
                    }
                    return withSunflowerAccountTransaction(
                        accountId,
                        (walletTx) =>
                            withAccountDeletionFenceTransaction(
                                accountId,
                                callback,
                                walletTx,
                            ),
                        tx,
                    );
                }),
            readCompletedPurchase: (accountId, operationId) =>
                getGardenPackPurchaseByOperation(accountId, operationId, db),
            readPurchase: getGardenPackPurchaseByOperation,
            grant: recordPurchasedGardenPack,
            debit: (accountId, amount, reason, tx) =>
                spendSunflowersBatch(accountId, [{ amount, reason }], tx),
            getCatalogue: async () => [
                {
                    snapshot,
                    sale: {
                        enabled: true,
                        availableFrom: null,
                        availableUntil: null,
                    },
                },
            ],
            getBlocks: async () => [block()],
            now: () => new Date('2026-10-02T21:00:00Z'),
        };
    const command = {
        operationId: randomUUID(),
        expectedAccountId: accountId,
        productId: snapshot.productId,
        quote: {
            productVersionId: snapshot.productVersionId,
            chargedSunflowers: 11,
            currency: 'sunflower',
        },
    } satisfies Parameters<
        ReturnType<typeof createGardenPackPurchaseService>
    >[1];
    return {
        accountId,
        snapshot,
        dependencies,
        backendPids,
        command,
        purchase: createGardenPackPurchaseService(dependencies),
    };
}
async function counts(accountId: string) {
    return {
        balance: await getSunflowers(accountId, db),
        purchases: (
            await db
                .select()
                .from(schema.gardenPackPurchases)
                .where(eq(schema.gardenPackPurchases.accountId, accountId))
        ).length,
    };
}

test('default-off gate avoids readiness/pack access and absent source schema reports not ready', async () => {
    const empty = new PGlite();
    try {
        assert.equal(
            await isGardenPackStorageReady(pgliteDrizzle(empty, { schema })),
            false,
        );
    } finally {
        await empty.close();
    }
    const f = await fixture();
    f.dependencies.isStorageEnabled = () => false;
    f.dependencies.isStorageReady = async () => {
        throw new Error('Disabled gate queried storage');
    };
    const result = await f.purchase(f.accountId, f.command);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'PACKS_DISABLED');
    assert.deepEqual(await counts(f.accountId), { balance: 100, purchases: 0 });
});

test('missing enabled source guard blocks new grants and separate sales switch preserves ownership', async () => {
    const f = await fixture();
    await db.execute(
        sql`ALTER TABLE garden_pack_units DISABLE TRIGGER garden_pack_unit_contents`,
    );
    try {
        assert.equal(await isGardenPackStorageReady(db), false);
        const blocked = await f.purchase(f.accountId, f.command);
        assert.ok(!blocked.ok && blocked.code === 'PACK_STORAGE_NOT_READY');
    } finally {
        await db.execute(
            sql`ALTER TABLE garden_pack_units ENABLE TRIGGER garden_pack_unit_contents`,
        );
    }
    assert.equal(await isGardenPackStorageReady(db), true);
    f.dependencies.isSalesEnabled = () => false;
    const blocked = await f.purchase(f.accountId, f.command);
    assert.ok(!blocked.ok && blocked.code === 'PACK_SALES_DISABLED');
    assert.deepEqual(await counts(f.accountId), { balance: 100, purchases: 0 });
});

test('concurrent same operation grants exactly one pack and spends exactly once on independent pool connections', async () => {
    const f = await fixture();
    const results = await Promise.all(
        Array.from({ length: 6 }, () => f.purchase(f.accountId, f.command)),
    );
    const ids = new Set(
        results
            .filter((result) => result.ok)
            .map((result) => result.receipt.purchaseId),
    );
    assert.equal(ids.size, 1);
    if (adminUrl)
        assert.ok(
            f.backendPids.size > 1,
            'Concurrency must use independent PostgreSQL backends',
        );
    assert.equal(
        results.filter((result) => result.ok && !result.replayed).length,
        1,
    );
    assert.equal(
        results.filter((result) => result.ok && result.replayed).length,
        5,
    );
    assert.deepEqual(await counts(f.accountId), { balance: 89, purchases: 1 });
    const purchase = await getGardenPackInventoryPurchase(
        f.accountId,
        [...ids][0] ?? '',
        db,
    );
    assert.equal(purchase?.remainingQuantity, 2);
    assert.deepEqual(purchase?.lines[0]?.availableUnitOrdinals, [1, 2]);
});

test('cold catalogue database reads finish before wallet transactions acquire locks', async () => {
    const f = await fixture();
    let transactionActive = false;
    let sharedReads = 0;
    const transact = f.dependencies.withAccountTransaction;
    f.dependencies.withAccountTransaction = (accountId, callback) =>
        transact(accountId, async (tx) => {
            transactionActive = true;
            try {
                return await callback(tx);
            } finally {
                transactionActive = false;
            }
        });
    f.dependencies.getBlocks = async () => {
        assert.equal(transactionActive, false);
        // Like the real uncached directory reader, this uses the shared pool.
        await db
            .select()
            .from(schema.accounts)
            .where(eq(schema.accounts.id, f.accountId));
        sharedReads += 1;
        return [block()];
    };
    assert.equal((await f.purchase(f.accountId, f.command)).ok, true);
    assert.equal(sharedReads, 1);
});

test('a concurrent completed receipt wins even when this request catalogue preparation fails', async () => {
    const f = await fixture();
    let notifyPreparation: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
        notifyPreparation = resolve;
    });
    let rejectPreparation: ((reason: Error) => void) | undefined;
    const blocked = new Promise<readonly BlockData[]>((_resolve, reject) => {
        rejectPreparation = reject;
    });
    const slow = createGardenPackPurchaseService({
        ...f.dependencies,
        getBlocks: async () => {
            notifyPreparation?.();
            return blocked;
        },
    });
    const pending = slow(f.accountId, f.command);
    await started;
    const winner = await f.purchase(f.accountId, f.command);
    assert.equal(winner.ok, true);
    rejectPreparation?.(new Error('cold catalogue unavailable'));
    const replay = await pending;
    assert.equal(replay.ok, true);
    if (winner.ok && replay.ok) {
        assert.equal(replay.replayed, true);
        assert.deepEqual(replay.receipt, winner.receipt);
    }
    assert.deepEqual(await counts(f.accountId), { balance: 89, purchases: 1 });
});

test('replay survives sale withdrawal and never reads broken/slow catalogue; changed quote conflicts', async () => {
    const f = await fixture();
    const first = await f.purchase(f.accountId, f.command);
    assert.ok(first.ok);
    f.dependencies.isSalesEnabled = () => false;
    f.dependencies.getCatalogue = async () => {
        throw new Error('Withdrawn catalogue unavailable');
    };
    f.dependencies.getBlocks = async () => new Promise(() => {});
    const retry = await f.purchase(f.accountId, f.command);
    assert.ok(retry.ok);
    assert.deepEqual(retry.receipt, first.receipt);
    assert.equal(retry.replayed, true);
    for (const command of [
        { ...f.command, productId: 'changed' },
        { ...f.command, quote: { ...f.command.quote, chargedSunflowers: 12 } },
        {
            ...f.command,
            quote: { ...f.command.quote, productVersionId: 'changed:v2' },
        },
    ]) {
        const result = await f.purchase(f.accountId, command);
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.code, 'OPERATION_CONFLICT');
    }
    assert.deepEqual(await counts(f.accountId), { balance: 89, purchases: 1 });
});

test('insufficient funds and concurrent different purchases cannot overdraw the wallet', async () => {
    const f = await fixture(11);
    const results = await Promise.all(
        [f.command, { ...f.command, operationId: randomUUID() }].map(
            (command) => f.purchase(f.accountId, command),
        ),
    );
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(
        results.filter(
            (result) => !result.ok && result.code === 'INSUFFICIENT_SUNFLOWERS',
        ).length,
        1,
    );
    assert.deepEqual(await counts(f.accountId), { balance: 0, purchases: 1 });
});

test('disabled, expired, stale, missing and unavailable offers leave balance and inventory unchanged', async () => {
    const f = await fixture();
    const sale = { enabled: false, availableFrom: null, availableUntil: null };
    f.dependencies.getCatalogue = async () => [{ snapshot: f.snapshot, sale }];
    let result = await f.purchase(f.accountId, f.command);
    assert.equal(result.ok, false);
    sale.enabled = true;
    f.dependencies.getCatalogue = async () => [
        {
            snapshot: f.snapshot,
            sale: { ...sale, availableUntil: '2026-09-01T00:00:00Z' },
        },
    ];
    result = await f.purchase(f.accountId, f.command);
    assert.equal(result.ok, false);
    f.dependencies.getCatalogue = async () => [{ snapshot: f.snapshot, sale }];
    result = await f.purchase(f.accountId, {
        ...f.command,
        quote: { ...f.command.quote, chargedSunflowers: 12 },
    });
    assert.ok(!result.ok && result.code === 'STALE_QUOTE');
    f.dependencies.getCatalogue = async () => [];
    result = await f.purchase(f.accountId, f.command);
    assert.ok(!result.ok && result.code === 'PACK_NOT_FOUND');
    f.dependencies.getCatalogue = async () => {
        throw new Error('Catalogue outage');
    };
    result = await f.purchase(f.accountId, f.command);
    assert.ok(!result.ok && result.code === 'PACK_CATALOGUE_UNAVAILABLE');
    assert.deepEqual(await counts(f.accountId), { balance: 100, purchases: 0 });
});

test('grant failure rolls back debit; debit failure cannot grant; account deletion fence blocks all new writes', async () => {
    const f = await fixture();
    const grant = f.dependencies.grant;
    f.dependencies.grant = async (...args) => {
        await grant(...args);
        throw new Error('Simulated grant failure after rows inserted');
    };
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args) => {
        errors.push(args);
    };
    try {
        assert.equal((await f.purchase(f.accountId, f.command)).ok, false);
        assert.deepEqual(await counts(f.accountId), {
            balance: 100,
            purchases: 0,
        });
        f.dependencies.grant = grant;
        f.dependencies.debit = async () => {
            throw new Error('Simulated wallet failure');
        };
        assert.equal((await f.purchase(f.accountId, f.command)).ok, false);
        assert.deepEqual(await counts(f.accountId), {
            balance: 100,
            purchases: 0,
        });
    } finally {
        console.error = original;
    }
    assert.equal(errors.length, 2);
    await db.transaction((tx) => markAccountDeletionStarted(f.accountId, tx));
    const result = await f.purchase(f.accountId, f.command);
    assert.ok(!result.ok && result.code === 'ACCOUNT_DELETION_IN_PROGRESS');
});

test('exact catalogue identity, supported codec and decoration-only eligibility fail closed', () => {
    const snapshot = product();
    const valid = block();
    assert.doesNotThrow(() =>
        assertGardenPackPurchaseContents(
            snapshot,
            [valid],
            new Date('2026-10-02T21:00:00Z'),
        ),
    );
    for (const blocks of [
        [
            valid,
            block({ information: { ...valid.information, name: 'Other' } }),
        ],
        [valid, block({ id: 124 })],
        [block({ functions: { recycler: true, raisedBed: false } })],
        [block({ attributes: { ...valid.attributes, type: 'raisedBed' } })],
        [block({ prices: { sunflowers: 0 } })],
        [block({ information: { ...valid.information, name: 'GardenBox' } })],
    ])
        assert.throws(() =>
            assertGardenPackPurchaseContents(snapshot, blocks, new Date()),
        );
    if (snapshot.lines[0])
        snapshot.lines[0].variant = {
            versionId: 'stale:v0',
            appearance: { id: 'orange' },
        };
    assert.throws(() =>
        assertGardenPackPurchaseContents(snapshot, [valid], new Date()),
    );
});

test('owned projection is isolated, persists after withdrawals and paginates ties/microseconds without duplicates', async () => {
    const f = await fixture();
    await f.purchase(f.accountId, f.command);
    await f.purchase(f.accountId, { ...f.command, operationId: randomUUID() });
    await f.purchase(f.accountId, { ...f.command, operationId: randomUUID() });
    const first = await getGardenPackInventoryPage(
        f.accountId,
        { limit: 1 },
        db,
    );
    assert.equal(first.purchases.length, 1);
    assert.ok(first.nextCursor);
    const second = await getGardenPackInventoryPage(
        f.accountId,
        { limit: 1, cursor: first.nextCursor },
        db,
    );
    assert.ok(second.nextCursor);
    const third = await getGardenPackInventoryPage(
        f.accountId,
        { limit: 1, cursor: second.nextCursor },
        db,
    );
    assert.equal(
        new Set(
            [...first.purchases, ...second.purchases, ...third.purchases].map(
                (purchase) => purchase.purchaseId,
            ),
        ).size,
        3,
    );
    assert.equal(third.hasMore, false);
    assert.deepEqual(
        (await getGardenPackInventoryPage(randomUUID(), {}, db)).purchases,
        [],
    );
    const purchaseId = first.purchases[0]?.purchaseId;
    assert.ok(purchaseId);
    assert.equal(
        await getGardenPackInventoryPurchase(randomUUID(), purchaseId, db),
        undefined,
    );
    await assert.rejects(() =>
        getGardenPackInventoryPage(f.accountId, { cursor: 'invalid' }, db),
    );
});
