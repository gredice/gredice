import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    accounts,
    closeStorage,
    createGardenBlock,
    createGardenStack,
    events,
    farms,
    gardens,
    getGardenPackPlacementReplay,
    getGardenPackPlacementUnitForUpdate,
    getGardenPackPurchaseByOperation,
    getGardenPlacementSnapshotForUpdate,
    getPurchasedGardenPack,
    getSunflowers,
    recordGardenPackPlacement,
    recordPurchasedGardenPack,
    refundGardenPackUnits,
    spendSunflowersBatch,
    storage,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { gardenPackProductSnapshotSchema } from '@gredice/storage/gardenPackContract';
import { loadReviewedAutumnStarterPackEvidence } from './autumnStarterPackEvidence';
import {
    getAutumnStarterPackVersion,
    prepareAutumnStarterPacks,
} from './autumnStarterPackPreparation';
import { createAutumnStarterPackTestDirectory } from './autumnStarterPackPreparation.fixture';
import { prepareGardenPackIntegrationSchema } from './gardenPackIntegrationSchema';
import { createGardenPackPlacementService } from './gardenPackPlacementService';
import { createGardenPackPurchaseService } from './gardenPackPurchaseService';

const enabled =
    process.env.TEST_ENV === '1' &&
    process.env.GREDICE_PACK_LIFECYCLE_TEST === '1';
before(async () => {
    if (enabled) await prepareGardenPackIntegrationSchema();
});
after(async () => {
    if (enabled) await closeStorage();
});
const blocks = createAutumnStarterPackTestDirectory();
const prepared = prepareAutumnStarterPacks(
    blocks,
    await loadReviewedAutumnStarterPackEvidence(),
);
assert.equal(prepared.ready, true);
const ground: BlockData = {
    ...blocks[0],
    id: 800_000,
    slug: 'test-ground',
    entityType: { id: 8, name: 'block', label: 'Blok' },
    information: {
        name: 'Block_Grass',
        label: 'Trava',
        shortDescription: 'Test',
        fullDescription: 'Test',
    },
    attributes: {
        height: 1,
        spanWidth: 1,
        spanDepth: 1,
        stackable: true,
        type: 'terrain',
        nightOnlyPurchase: false,
    },
    functions: { raisedBed: false, recycler: false },
    prices: { sunflowers: 1 },
    createdAt: '2026-10-02T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
};
const directory = [...blocks, ground];
for (const [index, offer] of prepared.offers.entries()) {
    test(`${offer.snapshot.name.hr}: purchase, partial exact placement, reload, repeat, withdrawal ownership and original-value refund`, {
        skip: !enabled,
    }, async () => {
        const accountId = randomUUID();
        await storage().insert(accounts).values({ id: accountId });
        await storage()
            .insert(events)
            .values({
                aggregateId: accountId,
                type: 'account.earnSunflowers',
                version: 1,
                data: { amount: 500, reason: 'test-only' },
            });
        const [farm] = await storage()
            .insert(farms)
            .values({ name: 'Test pack farm', latitude: 0, longitude: 0 })
            .returning();
        assert.ok(farm);
        const [garden] = await storage()
            .insert(gardens)
            .values({
                accountId,
                farmId: farm.id,
                name: 'Test pack garden',
                isSandbox: false,
            })
            .returning();
        assert.ok(garden);
        const groundIds: string[] = [];
        for (const y of [0, 2])
            for (const x of [0, 1]) {
                const id = await createGardenBlock(garden.id, 'Block_Grass');
                groundIds.push(id);
                await createGardenStack(garden.id, { x, y });
                await updateGardenStack(garden.id, { x, y, blocks: [id] });
            }
        const withAccountTransaction = <T>(
            owner: string,
            callback: Parameters<
                typeof withAccountDeletionFenceTransaction<T>
            >[1],
        ) =>
            withSunflowerAccountTransaction(owner, (tx) =>
                withAccountDeletionFenceTransaction(owner, callback, tx),
            );
        // Activation is test-only and creates a new immutable version. Offline builder never activates offers.
        const evidence = prepared.evidence[index];
        assert.ok(evidence);
        const {
            productId: _id,
            productVersionId: _version,
            ...proof
        } = evidence;
        const snapshot = gardenPackProductSnapshotSchema.parse({
            ...offer.snapshot,
            publication: 'published',
        });
        snapshot.productVersionId = getAutumnStarterPackVersion(
            snapshot,
            proof,
        );
        let catalogue = [
            {
                snapshot,
                sale: {
                    enabled: true,
                    availableFrom: null,
                    availableUntil: null,
                },
            },
        ];
        const purchase = createGardenPackPurchaseService({
            isStorageEnabled: () => true,
            isSalesEnabled: () => true,
            isStorageReady: async () => true,
            withAccountTransaction,
            readCompletedPurchase: getGardenPackPurchaseByOperation,
            readPurchase: getGardenPackPurchaseByOperation,
            grant: recordPurchasedGardenPack,
            debit: (owner, amount, reason, tx) =>
                spendSunflowersBatch(owner, [{ amount, reason }], tx),
            getCatalogue: async () => catalogue,
            getBlocks: async () => directory,
            now: () => new Date('2026-10-02T12:00:00Z'),
        });
        const command = {
            expectedAccountId: accountId,
            operationId: randomUUID(),
            productId: snapshot.productId,
            quote: {
                productVersionId: snapshot.productVersionId,
                chargedSunflowers: snapshot.chargedSunflowers,
                currency: snapshot.currency,
            },
        };
        const bought = await purchase(accountId, command);
        assert.ok(bought.ok);
        const line = snapshot.lines[0];
        const refundable = snapshot.lines[1];
        assert.ok(line);
        assert.ok(refundable);
        const placement = createGardenPackPlacementService({
            withAccountTransaction,
            withGardenTransaction: withGardenPlacementTransaction,
            getReplay: getGardenPackPlacementReplay,
            getUnit: getGardenPackPlacementUnitForUpdate,
            getSnapshot: getGardenPlacementSnapshotForUpdate,
            getBlockData: async () => directory,
            createBlock: createGardenBlock,
            createStack: createGardenStack,
            updateStack: updateGardenStack,
            recordPlacement: recordGardenPackPlacement,
        });
        const placed = await placement({
            accountId,
            gardenId: garden.id,
            purchaseId: bought.receipt.purchaseId,
            lineId: line.lineId,
            unitOrdinal: 1,
            operationId: randomUUID(),
            position: { x: 0, y: 0 },
            expectedExistingBlocks: [groundIds[0]].filter(
                (id) => id !== undefined,
            ),
            variant: null,
        });
        assert.ok(placed.ok);
        assert.equal(
            (await getPurchasedGardenPack(accountId, bought.receipt.purchaseId))
                ?.remainingQuantity,
            3,
        );
        assert.equal(
            await getSunflowers(accountId),
            500 - snapshot.chargedSunflowers,
        );
        const repeat = await purchase(accountId, {
            ...command,
            operationId: randomUUID(),
        });
        assert.ok(repeat.ok);
        assert.notEqual(repeat.receipt.purchaseId, bought.receipt.purchaseId);
        catalogue = [];
        const postWithdrawal = await placement({
            accountId,
            gardenId: garden.id,
            purchaseId: repeat.receipt.purchaseId,
            lineId: line.lineId,
            unitOrdinal: 1,
            operationId: randomUUID(),
            position: { x: 0, y: 2 },
            expectedExistingBlocks: [groundIds[2]].filter(
                (id) => id !== undefined,
            ),
            variant: null,
        });
        assert.ok(postWithdrawal.ok);
        assert.equal(
            await getSunflowers(accountId),
            500 - 2 * snapshot.chargedSunflowers,
        );
        assert.equal(
            (await getPurchasedGardenPack(accountId, repeat.receipt.purchaseId))
                ?.remainingQuantity,
            3,
        );
        const replay = await purchase(accountId, command);
        assert.ok(replay.ok);
        assert.equal(replay.receipt.purchaseId, bought.receipt.purchaseId);
        assert.equal(
            (await getPurchasedGardenPack(accountId, bought.receipt.purchaseId))
                ?.remainingQuantity,
            3,
        );
        const refundCommand = {
            purchaseId: bought.receipt.purchaseId,
            operationId: randomUUID(),
            units: [{ lineId: refundable.lineId, unitOrdinal: 1 }],
        };
        const refunded = await refundGardenPackUnits(accountId, refundCommand);
        assert.ok('creditedSunflowers' in refunded);
        assert.equal(
            refunded.creditedSunflowers,
            refundable.paidSunflowersByUnit[0],
        );
        assert.equal(
            (await refundGardenPackUnits(accountId, refundCommand)).replayed,
            true,
        );
        assert.equal(
            await getSunflowers(accountId),
            500 - 2 * snapshot.chargedSunflowers + refunded.creditedSunflowers,
        );
        assert.equal(
            (await getPurchasedGardenPack(accountId, bought.receipt.purchaseId))
                ?.remainingQuantity,
            2,
        );
    });
}
