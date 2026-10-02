import 'server-only';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getGardenPackUnits } from '../gardenPackContract';
import {
    gardenBlocks,
    gardenPackLifecycleReceipts,
    gardenPackPurchases,
    gardenPackUnitEvents,
    gardenPackUnitLocations,
    gardenPackUnits,
} from '../schema';
import { storage } from '../storage';
import { withAccountDeletionFenceTransaction } from './accountDeletionFenceRepo';
import {
    earnSunflowersOnce,
    withSunflowerAccountTransaction,
} from './accountsRepo';
import { createEvent, knownEvents } from './events';
import {
    GardenPackConflictError,
    GardenPackNotFoundError,
    type GardenPackTransaction,
    getPurchasedGardenPack,
    transitionPurchasedGardenPackUnit,
} from './gardenPacksRepo';
import {
    getGardenPlacementSnapshotForUpdate,
    withGardenPlacementTransaction,
} from './gardenPlacementRepo';
import { updateGardenStack } from './gardensRepo';
import {
    GardenBoxInventoryLimitError,
    getGardenBoxInventory,
    withGardenBoxInventoryTransaction,
} from './inventoryRepo';

type Database = ReturnType<typeof storage> | GardenPackTransaction;
const identity = z.strictObject({
    purchaseId: z.string().uuid(),
    lineId: z.string().min(1).max(100),
    unitOrdinal: z.number().int().min(1).max(1000),
});
export type GardenPackUnitIdentity = z.infer<typeof identity>;
function unitWhere(unit: GardenPackUnitIdentity) {
    return and(
        eq(gardenPackUnits.purchaseId, unit.purchaseId),
        eq(gardenPackUnits.lineId, unit.lineId),
        eq(gardenPackUnits.unitOrdinal, unit.unitOrdinal),
    );
}
function locationWhere(unit: GardenPackUnitIdentity) {
    return and(
        eq(gardenPackUnitLocations.purchaseId, unit.purchaseId),
        eq(gardenPackUnitLocations.lineId, unit.lineId),
        eq(gardenPackUnitLocations.unitOrdinal, unit.unitOrdinal),
    );
}
export async function isGardenPackLifecycleStorageReady(
    db: Database = storage(),
) {
    const result = await db.execute(sql`select
        (select count(*) = 2 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=current_schema() and c.relname in ('garden_pack_unit_locations','garden_pack_lifecycle_receipts') and c.relkind='r') AND
        (select count(*) = 8 from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=current_schema() and t.tgname in ('garden_pack_lifecycle_immutable','garden_pack_location_validate','garden_pack_unit_location_validate','garden_pack_block_location_validate','garden_pack_garden_location_validate','garden_pack_purchase_detach_locations','garden_pack_event_operation_namespace','garden_pack_lifecycle_operation_namespace') and t.tgenabled in ('O','A') and not t.tgisinternal and (t.tgname not in ('garden_pack_location_validate','garden_pack_unit_location_validate','garden_pack_block_location_validate','garden_pack_garden_location_validate') or (t.tgdeferrable and t.tginitdeferred))) AND
        (select count(*)=13 from information_schema.columns where table_schema=current_schema() and ((table_name='garden_pack_unit_locations' and column_name in ('purchase_id','line_id','unit_ordinal','garden_id','block_id','garden_box_block_id')) or (table_name='garden_pack_lifecycle_receipts' and column_name in ('id','account_id','operation_id','kind','payload','response','created_at')))) as ready`);
    return (
        z
            .object({ rows: z.array(z.object({ ready: z.boolean() })) })
            .parse(result).rows[0]?.ready === true
    );
}
export async function isPurchasedGardenPackBlock(
    blockId: string,
    db: Database = storage(),
) {
    if (!(await isGardenPackLifecycleStorageReady(db))) return false;
    const [unit] = await db
        .select({ purchaseId: gardenPackUnits.purchaseId })
        .from(gardenPackUnits)
        .where(eq(gardenPackUnits.blockId, blockId))
        .limit(1);
    return Boolean(unit);
}
export async function getGardenPackBlockLocation(
    blockId: string,
    db: Database = storage(),
) {
    if (!(await isGardenPackLifecycleStorageReady(db))) return null;
    const [location] = await db
        .select()
        .from(gardenPackUnitLocations)
        .where(eq(gardenPackUnitLocations.blockId, blockId))
        .limit(1);
    return location ?? null;
}
export async function getGardenBoxStoredPackUnits(
    accountId: string,
    gardenId: number,
    gardenBoxBlockId: string,
    db: Database = storage(),
) {
    if (!(await isGardenPackLifecycleStorageReady(db))) return [];
    const rows = await db
        .select({
            location: gardenPackUnitLocations,
            snapshot: gardenPackPurchases.snapshot,
        })
        .from(gardenPackUnitLocations)
        .innerJoin(
            gardenPackPurchases,
            eq(gardenPackPurchases.id, gardenPackUnitLocations.purchaseId),
        )
        .where(
            and(
                eq(gardenPackPurchases.accountId, accountId),
                eq(gardenPackUnitLocations.gardenId, gardenId),
                eq(gardenPackUnitLocations.gardenBoxBlockId, gardenBoxBlockId),
            ),
        );
    return rows.map(({ location, snapshot }) => {
        const unit = getGardenPackUnits(snapshot).find(
            (candidate) =>
                candidate.lineId === location.lineId &&
                candidate.unitOrdinal === location.unitOrdinal,
        );
        if (!unit) throw new Error('Stored pack unit snapshot is missing');
        return {
            ...location,
            entityId: unit.entityId,
            modelName: unit.modelName,
            variant: unit.variant,
            amount: 1,
            entityTypeName: 'block',
        };
    });
}
export async function assertGardenBoxCombinedCapacity(
    accountId: string,
    gardenId: number,
    boxId: string,
    extra: { entityId: string; amount: number }[],
    tx: GardenPackTransaction,
) {
    const ordinary = await getGardenBoxInventory(
        accountId,
        gardenId,
        boxId,
        tx,
    );
    const exact = await getGardenBoxStoredPackUnits(
        accountId,
        gardenId,
        boxId,
        tx,
    );
    const totals = new Map<string, number>();
    for (const item of [...ordinary, ...exact, ...extra])
        totals.set(
            item.entityId,
            (totals.get(item.entityId) ?? 0) + item.amount,
        );
    if (totals.size > 6 || [...totals.values()].some((amount) => amount > 10))
        throw new GardenBoxInventoryLimitError(
            'Vrtna kutija može sadržavati najviše 6 vrsta s po 10 predmeta.',
        );
}
export async function getGardenPackLifecycleReplay(
    accountId: string,
    operationId: string,
    kind: typeof gardenPackLifecycleReceipts.$inferInsert.kind,
    payload: Record<string, unknown>,
    tx: GardenPackTransaction,
) {
    // Share operation namespace with prepaid placement and refunds/recycling.
    const [placement] = await tx
        .select({ id: gardenPackUnitEvents.id })
        .from(gardenPackUnitEvents)
        .where(
            and(
                eq(gardenPackUnitEvents.accountId, accountId),
                eq(gardenPackUnitEvents.operationId, operationId),
            ),
        )
        .limit(1);
    const [receipt] = await tx
        .select()
        .from(gardenPackLifecycleReceipts)
        .where(
            and(
                eq(gardenPackLifecycleReceipts.accountId, accountId),
                eq(gardenPackLifecycleReceipts.operationId, operationId),
            ),
        )
        .limit(1);
    if (receipt) {
        if (
            receipt.kind !== kind ||
            !isDeepStrictEqual(receipt.payload, payload)
        )
            throw new GardenPackConflictError(
                'Lifecycle operation has different contents',
            );
        return receipt.response;
    }
    if (placement)
        throw new GardenPackConflictError(
            'Operation already belongs to another pack mutation',
        );
    return null;
}
async function recordReceipt(
    accountId: string,
    operationId: string,
    kind: typeof gardenPackLifecycleReceipts.$inferInsert.kind,
    payload: Record<string, unknown>,
    response: Record<string, unknown>,
    tx: GardenPackTransaction,
) {
    await tx.insert(gardenPackLifecycleReceipts).values({
        id: randomUUID(),
        accountId,
        operationId,
        kind,
        payload,
        response,
    });
}
async function lockOwnedUnit(
    accountId: string,
    input: GardenPackUnitIdentity,
    tx: GardenPackTransaction,
) {
    identity.parse({
        purchaseId: input.purchaseId,
        lineId: input.lineId,
        unitOrdinal: input.unitOrdinal,
    });
    const [purchase] = await tx
        .select({ id: gardenPackPurchases.id })
        .from(gardenPackPurchases)
        .where(
            and(
                eq(gardenPackPurchases.id, input.purchaseId),
                eq(gardenPackPurchases.accountId, accountId),
            ),
        )
        .for('update')
        .limit(1);
    if (!purchase)
        throw new GardenPackNotFoundError('Purchased pack not found');
    const [unit] = await tx
        .select()
        .from(gardenPackUnits)
        .where(unitWhere(input))
        .for('update')
        .limit(1);
    if (!unit) throw new GardenPackNotFoundError('Purchased unit not found');
    const [location] = await tx
        .select()
        .from(gardenPackUnitLocations)
        .where(locationWhere(input))
        .for('update')
        .limit(1);
    return { unit, location };
}
export async function refundGardenPackUnits(
    accountId: string,
    input: {
        purchaseId: string;
        operationId: string;
        units: { lineId: string; unitOrdinal: number }[];
    },
) {
    z.strictObject({
        purchaseId: z.string().uuid(),
        operationId: z.string().min(1).max(96),
        units: z
            .array(identity.omit({ purchaseId: true }))
            .min(1)
            .max(1000),
    }).parse(input);
    if (
        new Set(input.units.map((unit) => `${unit.lineId}:${unit.unitOrdinal}`))
            .size !== input.units.length
    )
        throw new GardenPackConflictError('Refund units must be distinct');
    return withSunflowerAccountTransaction(accountId, (tx) =>
        withAccountDeletionFenceTransaction(
            accountId,
            async (accountTx) => {
                const payload = {
                    purchaseId: input.purchaseId,
                    units: input.units,
                };
                const replay = await getGardenPackLifecycleReplay(
                    accountId,
                    input.operationId,
                    'refund',
                    payload,
                    accountTx,
                );
                if (replay) return { ...replay, replayed: true };
                let creditedSunflowers = 0;
                for (const requested of [...input.units].sort(
                    (a, b) =>
                        a.lineId.localeCompare(b.lineId) ||
                        a.unitOrdinal - b.unitOrdinal,
                )) {
                    const unitIdentity = {
                        purchaseId: input.purchaseId,
                        ...requested,
                    };
                    const { unit } = await lockOwnedUnit(
                        accountId,
                        unitIdentity,
                        accountTx,
                    );
                    if (unit.state !== 'available')
                        throw new GardenPackConflictError(
                            'Only unused pack units can be refunded',
                        );
                    const transition = await transitionPurchasedGardenPackUnit(
                        accountId,
                        {
                            ...unitIdentity,
                            operationId: randomUUID(),
                            kind: 'refunded',
                        },
                        accountTx,
                    );
                    creditedSunflowers += transition.event.creditedSunflowers;
                }
                if (creditedSunflowers > 0)
                    await earnSunflowersOnce(
                        accountId,
                        creditedSunflowers,
                        `gardenPack:refund:${input.operationId}`,
                        accountTx,
                    );
                const response = {
                    creditedSunflowers,
                    refundedQuantity: input.units.length,
                };
                await recordReceipt(
                    accountId,
                    input.operationId,
                    'refund',
                    payload,
                    response,
                    accountTx,
                );
                return { ...response, replayed: false };
            },
            tx,
        ),
    );
}
/** No catalogue dependency: recovery remains possible after an asset is disabled. */
export async function recycleGardenPackUnitForAccount(
    accountId: string,
    input: {
        gardenId: number;
        blockId: string;
        expectedSource?: { x: number; y: number; blockIndex: number };
    },
) {
    return withSunflowerAccountTransaction(accountId, (tx) =>
        withAccountDeletionFenceTransaction(
            accountId,
            async (accountTx) => {
                const operationId = `pack-recycle:${input.blockId}`;
                const replay = await getGardenPackLifecycleReplay(
                    accountId,
                    operationId,
                    'recycle',
                    input,
                    accountTx,
                );
                if (replay) return replay;
                const location = await getGardenPackBlockLocation(
                    input.blockId,
                    accountTx,
                );
                if (
                    !location ||
                    location.gardenId !== input.gardenId ||
                    location.gardenBoxBlockId
                )
                    throw new GardenPackNotFoundError(
                        'Placed purchased unit not found',
                    );
                await lockOwnedUnit(accountId, location, accountTx);
                return withGardenPlacementTransaction(
                    input.gardenId,
                    async (gardenTx) => {
                        const snapshot =
                            await getGardenPlacementSnapshotForUpdate(
                                input.gardenId,
                                gardenTx,
                            );
                        if (
                            !snapshot ||
                            snapshot.garden.accountId !== accountId ||
                            snapshot.garden.isSandbox
                        )
                            throw new GardenPackNotFoundError(
                                'Owned garden not found',
                            );
                        if (input.expectedSource) {
                            const expected = input.expectedSource;
                            const source = snapshot.stacks.find(
                                (stack) =>
                                    stack.positionX === expected.x &&
                                    stack.positionY === expected.y,
                            );
                            if (
                                source?.blocks[expected.blockIndex] !==
                                input.blockId
                            )
                                throw new GardenPackConflictError(
                                    'Source stack changed before recycling',
                                );
                        }
                        const result = await recycleLocatedUnit(
                            accountId,
                            location,
                            operationId,
                            gardenTx,
                        );
                        const response = {
                            blockId: input.blockId,
                            refundedSunflowers: result,
                        };
                        await recordReceipt(
                            accountId,
                            operationId,
                            'recycle',
                            input,
                            response,
                            gardenTx,
                        );
                        return response;
                    },
                    accountTx,
                );
            },
            tx,
        ),
    );
}
async function recycleLocatedUnit(
    accountId: string,
    location: typeof gardenPackUnitLocations.$inferSelect,
    operationId: string,
    tx: GardenPackTransaction,
) {
    const transition = await transitionPurchasedGardenPackUnit(
        accountId,
        {
            purchaseId: location.purchaseId,
            lineId: location.lineId,
            unitOrdinal: location.unitOrdinal,
            kind: 'recycled',
            operationId,
        },
        tx,
    );
    const snapshot = await getGardenPlacementSnapshotForUpdate(
        location.gardenId,
        tx,
    );
    for (const stack of snapshot?.stacks ?? [])
        if (stack.blocks.includes(location.blockId))
            await updateGardenStack(
                location.gardenId,
                {
                    x: stack.positionX,
                    y: stack.positionY,
                    blocks: stack.blocks.filter(
                        (id) => id !== location.blockId,
                    ),
                },
                tx,
            );
    await tx.delete(gardenPackUnitLocations).where(locationWhere(location));
    await tx
        .update(gardenBlocks)
        .set({ isDeleted: true })
        .where(eq(gardenBlocks.id, location.blockId));
    await createEvent(
        knownEvents.gardens.blockRemovedV1(location.gardenId.toString(), {
            id: location.blockId,
        }),
        tx,
    );
    if (transition.event.creditedSunflowers > 0)
        await earnSunflowersOnce(
            accountId,
            transition.event.creditedSunflowers,
            `gardenPack:recycle:${location.blockId}`,
            tx,
        );
    return transition.event.creditedSunflowers;
}
export async function lockGardenPackUnitsForGardenDeletion(
    accountId: string,
    gardenId: number,
    tx: GardenPackTransaction,
) {
    if (!(await isGardenPackLifecycleStorageReady(tx))) return;
    const locations = await tx
        .select()
        .from(gardenPackUnitLocations)
        .where(eq(gardenPackUnitLocations.gardenId, gardenId))
        .orderBy(
            gardenPackUnitLocations.purchaseId,
            gardenPackUnitLocations.lineId,
            gardenPackUnitLocations.unitOrdinal,
        );
    for (const location of locations)
        await lockOwnedUnit(accountId, location, tx);
}
export async function recycleGardenPackUnitsForGardenDeletion(
    accountId: string,
    gardenId: number,
    tx: GardenPackTransaction,
) {
    if (!(await isGardenPackLifecycleStorageReady(tx))) return;
    const locations = await tx
        .select()
        .from(gardenPackUnitLocations)
        .where(eq(gardenPackUnitLocations.gardenId, gardenId));
    for (const location of locations)
        await recycleLocatedUnit(accountId, location, randomUUID(), tx);
}
export async function storeGardenPackBlock(
    accountId: string,
    input: {
        gardenId: number;
        blockId: string;
        gardenBoxBlockId: string;
        operationId?: string;
        blockIndex: number;
        sourcePosition: { x: number; z: number };
    },
) {
    const operationId = input.operationId ?? randomUUID();
    return withGardenBoxInventoryTransaction(
        accountId,
        input.gardenId,
        input.gardenBoxBlockId,
        async (tx) => {
            const replay = await getGardenPackLifecycleReplay(
                accountId,
                operationId,
                'store',
                input,
                tx,
            );
            if (replay) return { ...replay, replayed: true };
            const location = await getGardenPackBlockLocation(
                input.blockId,
                tx,
            );
            if (
                !location ||
                location.gardenId !== input.gardenId ||
                location.gardenBoxBlockId
            )
                throw new GardenPackNotFoundError(
                    'Placed purchased unit not found',
                );
            const { unit } = await lockOwnedUnit(accountId, location, tx);
            if (unit.state !== 'placed')
                throw new GardenPackConflictError(
                    'Purchased unit is no longer placed',
                );
            const pack = await getPurchasedGardenPack(
                accountId,
                location.purchaseId,
                tx,
            );
            const snapshotUnit =
                pack &&
                getGardenPackUnits(pack.snapshot).find(
                    (u) =>
                        u.lineId === location.lineId &&
                        u.unitOrdinal === location.unitOrdinal,
                );
            if (!snapshotUnit)
                throw new GardenPackNotFoundError(
                    'Purchased unit snapshot missing',
                );
            return withGardenPlacementTransaction(
                input.gardenId,
                async (gardenTx) => {
                    const snapshot = await getGardenPlacementSnapshotForUpdate(
                        input.gardenId,
                        gardenTx,
                    );
                    if (
                        !snapshot ||
                        snapshot.garden.accountId !== accountId ||
                        snapshot.garden.isSandbox ||
                        !snapshot.blocks.some(
                            (b) =>
                                b.id === input.gardenBoxBlockId &&
                                b.name === 'GardenBox',
                        ) ||
                        !snapshot.stacks.some((s) =>
                            s.blocks.includes(input.gardenBoxBlockId),
                        )
                    )
                        throw new GardenPackNotFoundError(
                            'Owned placed garden box not found',
                        );
                    const stack = snapshot.stacks.find(
                        (s) =>
                            s.positionX === input.sourcePosition.x &&
                            s.positionY === input.sourcePosition.z,
                    );
                    if (
                        !stack ||
                        stack.blocks[input.blockIndex] !== input.blockId ||
                        input.blockIndex !== stack.blocks.length - 1
                    )
                        throw new GardenPackConflictError(
                            'Source stack changed or purchased block is covered',
                        );
                    await assertGardenBoxCombinedCapacity(
                        accountId,
                        input.gardenId,
                        input.gardenBoxBlockId,
                        [{ entityId: snapshotUnit.entityId, amount: 1 }],
                        gardenTx,
                    );
                    await gardenTx
                        .update(gardenPackUnitLocations)
                        .set({ gardenBoxBlockId: input.gardenBoxBlockId })
                        .where(locationWhere(location));
                    await updateGardenStack(
                        input.gardenId,
                        {
                            x: stack.positionX,
                            y: stack.positionY,
                            blocks: stack.blocks.filter(
                                (id) => id !== input.blockId,
                            ),
                        },
                        gardenTx,
                    );
                    await gardenTx
                        .update(gardenBlocks)
                        .set({ isDeleted: true })
                        .where(eq(gardenBlocks.id, input.blockId));
                    await createEvent(
                        knownEvents.gardens.blockRemovedV1(
                            input.gardenId.toString(),
                            { id: input.blockId },
                        ),
                        gardenTx,
                    );
                    const response = {
                        blockId: input.blockId,
                        item: {
                            entityTypeName: 'block',
                            entityId: snapshotUnit.entityId,
                            amount: 1,
                        },
                    };
                    await recordReceipt(
                        accountId,
                        operationId,
                        'store',
                        input,
                        response,
                        gardenTx,
                    );
                    return { ...response, replayed: false };
                },
                tx,
            );
        },
    );
}
export async function withStoredGardenPackUnit<T>(
    accountId: string,
    input: GardenPackUnitIdentity & {
        gardenId: number;
        gardenBoxBlockId: string;
        operationId: string;
    },
    payload: Record<string, unknown>,
    callback: (
        unit: ReturnType<typeof getGardenPackUnits>[number],
        blockId: string,
        tx: GardenPackTransaction,
    ) => Promise<Record<string, unknown>>,
    parseResponse: (response: Record<string, unknown>) => T,
) {
    return withGardenBoxInventoryTransaction(
        accountId,
        input.gardenId,
        input.gardenBoxBlockId,
        async (tx) => {
            const replay = await getGardenPackLifecycleReplay(
                accountId,
                input.operationId,
                'retrieve',
                payload,
                tx,
            );
            if (replay) return parseResponse(replay);
            const { unit, location } = await lockOwnedUnit(
                accountId,
                input,
                tx,
            );
            if (
                unit.state !== 'placed' ||
                !location ||
                location.gardenId !== input.gardenId ||
                location.gardenBoxBlockId !== input.gardenBoxBlockId
            )
                throw new GardenPackConflictError(
                    'Exact purchased unit is not stored in this box',
                );
            const pack = await getPurchasedGardenPack(
                accountId,
                input.purchaseId,
                tx,
            );
            const snapshotUnit =
                pack &&
                getGardenPackUnits(pack.snapshot).find(
                    (candidate) =>
                        candidate.lineId === input.lineId &&
                        candidate.unitOrdinal === input.unitOrdinal,
                );
            if (!snapshotUnit)
                throw new GardenPackNotFoundError(
                    'Purchased unit snapshot missing',
                );
            const response = await withGardenPlacementTransaction(
                input.gardenId,
                (gardenTx) =>
                    callback(snapshotUnit, location.blockId, gardenTx),
                tx,
            );
            await tx
                .update(gardenBlocks)
                .set({ isDeleted: false, rotation: 0 })
                .where(eq(gardenBlocks.id, location.blockId));
            await tx
                .update(gardenPackUnitLocations)
                .set({ gardenBoxBlockId: null })
                .where(locationWhere(location));
            await createEvent(
                knownEvents.gardens.blockPlacedV2(input.gardenId.toString(), {
                    id: location.blockId,
                    name: snapshotUnit.modelName,
                    variant: z
                        .number()
                        .int()
                        .nullable()
                        .parse(response.variant),
                }),
                tx,
            );
            await recordReceipt(
                accountId,
                input.operationId,
                'retrieve',
                payload,
                response,
                tx,
            );
            return parseResponse(response);
        },
    );
}
