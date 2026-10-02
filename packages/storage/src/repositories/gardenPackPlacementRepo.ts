import { isGardenPackLifecycleStorageReady } from './gardenPackLifecycleRepo';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getGardenPackUnits } from '../gardenPackContract';
import {
    type GardenPackPlacementCommand,
    type GardenPackPlacementResponse,
    gardenPackPlacementResponseSchema,
} from '../gardenPackPlacementContract';
import {
    gardenPackLifecycleReceipts,
    gardenPackPurchases,
    gardenPackUnitEvents,
    gardenPackUnitLocations,
    gardenPackUnits,
} from '../schema';
import { storage } from '../storage';
import {
    GardenPackConflictError,
    GardenPackNotFoundError,
    type GardenPackTransaction,
    getPurchasedGardenPack,
} from './gardenPacksRepo';

export function gardenPackPlacementPayload(
    command: GardenPackPlacementCommand,
) {
    return {
        gardenId: command.gardenId,
        purchaseId: command.purchaseId,
        lineId: command.lineId,
        unitOrdinal: command.unitOrdinal,
        position: command.position,
        expectedExistingBlocks: command.expectedExistingBlocks,
        variant: command.variant,
    };
}
export async function getGardenPackPlacementReplay(
    command: GardenPackPlacementCommand,
    tx: GardenPackTransaction | ReturnType<typeof storage> = storage(),
) {
    const [event] = await tx
        .select()
        .from(gardenPackUnitEvents)
        .where(
            and(
                eq(gardenPackUnitEvents.accountId, command.accountId),
                eq(gardenPackUnitEvents.operationId, command.operationId),
            ),
        )
        .limit(1);
    if (!event) {
        const [lifecycle] = await tx
            .select({ id: gardenPackLifecycleReceipts.id })
            .from(gardenPackLifecycleReceipts)
            .where(
                and(
                    eq(
                        gardenPackLifecycleReceipts.accountId,
                        command.accountId,
                    ),
                    eq(
                        gardenPackLifecycleReceipts.operationId,
                        command.operationId,
                    ),
                ),
            )
            .limit(1);
        if (lifecycle)
            throw new GardenPackConflictError(
                'Operation already belongs to a lifecycle mutation',
            );
        return null;
    }
    if (
        event.kind !== 'placed' ||
        !isDeepStrictEqual(
            event.placementPayload,
            gardenPackPlacementPayload(command),
        )
    )
        throw new GardenPackConflictError(
            'Placement operation has different contents',
        );
    return gardenPackPlacementResponseSchema.parse(event.placementResponse);
}
/** Acquire account economic/deletion fence before this purchase and unit lock, then the garden lock. */
export async function getGardenPackPlacementUnitForUpdate(
    command: GardenPackPlacementCommand,
    tx: GardenPackTransaction,
) {
    const [purchase] = await tx
        .select({ id: gardenPackPurchases.id })
        .from(gardenPackPurchases)
        .where(
            and(
                eq(gardenPackPurchases.id, command.purchaseId),
                eq(gardenPackPurchases.accountId, command.accountId),
            ),
        )
        .for('update')
        .limit(1);
    if (!purchase)
        throw new GardenPackNotFoundError('Purchased pack not found');
    const [unit] = await tx
        .select()
        .from(gardenPackUnits)
        .where(
            and(
                eq(gardenPackUnits.purchaseId, command.purchaseId),
                eq(gardenPackUnits.lineId, command.lineId),
                eq(gardenPackUnits.unitOrdinal, command.unitOrdinal),
            ),
        )
        .for('update')
        .limit(1);
    if (!unit) throw new GardenPackNotFoundError('Purchased unit not found');
    if (unit.state !== 'available')
        throw new GardenPackConflictError(
            'Purchased unit has already been used',
        );
    const pack = await getPurchasedGardenPack(
        command.accountId,
        command.purchaseId,
        tx,
    );
    const snapshotUnit =
        pack &&
        getGardenPackUnits(pack.snapshot).find(
            (candidate) =>
                candidate.lineId === command.lineId &&
                candidate.unitOrdinal === command.unitOrdinal,
        );
    if (!snapshotUnit)
        throw new GardenPackNotFoundError('Purchased unit snapshot not found');
    if (!isDeepStrictEqual(snapshotUnit.variant, command.variant))
        throw new GardenPackConflictError(
            'Fixed pack appearance does not match',
        );
    return snapshotUnit;
}
/** Block and stack creation must share this transaction; no wallet mutation occurs. */
export async function recordGardenPackPlacement(
    command: GardenPackPlacementCommand,
    response: GardenPackPlacementResponse,
    tx: GardenPackTransaction,
) {
    gardenPackPlacementResponseSchema.parse(response);
    await tx.insert(gardenPackUnitLocations).values({
        purchaseId: command.purchaseId,
        lineId: command.lineId,
        unitOrdinal: command.unitOrdinal,
        gardenId: command.gardenId,
        blockId: response.blockId,
    });
    await tx.insert(gardenPackUnitEvents).values({
        id: randomUUID(),
        accountId: command.accountId,
        purchaseId: command.purchaseId,
        lineId: command.lineId,
        unitOrdinal: command.unitOrdinal,
        operationId: command.operationId,
        kind: 'placed',
        creditedSunflowers: 0,
        gardenId: command.gardenId,
        blockId: response.blockId,
        placementPayload: gardenPackPlacementPayload(command),
        placementResponse: response,
    });
    await tx
        .update(gardenPackUnits)
        .set({
            state: 'placed',
            gardenId: command.gardenId,
            blockId: response.blockId,
        })
        .where(
            and(
                eq(gardenPackUnits.purchaseId, command.purchaseId),
                eq(gardenPackUnits.lineId, command.lineId),
                eq(gardenPackUnits.unitOrdinal, command.unitOrdinal),
            ),
        );
}

export class GardenPackLifecyclePendingError extends Error {
    override readonly name = 'GardenPackLifecyclePendingError';
    constructor() {
        super(
            'Prepaid pack storage, recycling, appearance changes and garden deletion are awaiting provenance-safe lifecycle support.',
        );
    }
}
/** Probe before referencing optional tables; protect persisted units even when rollout is switched off. */
export async function assertGardenPackLifecycleAllowed(
    input: { blockId?: string; gardenId?: number },
    db: GardenPackTransaction | ReturnType<typeof storage> = storage(),
) {
    const result = await db.execute(
        sql`select to_regclass('public.garden_pack_units') is not null as ready`,
    );
    if (
        z
            .object({ rows: z.array(z.object({ ready: z.boolean() })) })
            .parse(result).rows[0]?.ready !== true
    )
        return;
    const where = input.blockId
        ? eq(gardenPackUnits.blockId, input.blockId)
        : input.gardenId
          ? eq(gardenPackUnits.gardenId, input.gardenId)
          : undefined;
    if (!where)
        throw new Error(
            'Garden pack lifecycle guard requires a block or garden',
        );
    const [unit] = await db
        .select({ purchaseId: gardenPackUnits.purchaseId })
        .from(gardenPackUnits)
        .where(and(where, eq(gardenPackUnits.state, 'placed')))
        .limit(1);
    if (unit) throw new GardenPackLifecyclePendingError();
}

/** Check receipt columns separately so a partial migration never reaches placement queries. */
export async function isGardenPackPlacementStorageReady(
    db: GardenPackTransaction | ReturnType<typeof storage> = storage(),
) {
    const result = await db.execute(
        sql`select count(*) = 2 as ready from information_schema.columns where table_schema = current_schema() and table_name = 'garden_pack_unit_events' and column_name in ('placement_payload', 'placement_response') and data_type = 'jsonb'`,
    );
    return (
        z
            .object({ rows: z.array(z.object({ ready: z.boolean() })) })
            .parse(result).rows[0]?.ready === true &&
        (await isGardenPackLifecycleStorageReady(db))
    );
}
