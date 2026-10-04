import 'server-only';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
    gardenPackProductSnapshotSchema,
    getGardenPackUnits,
} from '../gardenPackContract';
import {
    gardenPackProductVersions,
    gardenPackPurchases,
    gardenPackUnitEvents,
    gardenPackUnits,
    gardens,
} from '../schema';
import { storage } from '../storage';
import {
    AccountNotFoundError,
    lockAccountAndAssertNotDeleting,
} from './accountDeletionFenceRepo';

export type GardenPackTransaction = Parameters<
    Parameters<ReturnType<typeof storage>['transaction']>[0]
>[0];
type Database = ReturnType<typeof storage> | GardenPackTransaction;
const ownerId = z.string().min(1).max(128);
const operationId = z.string().min(1).max(128);
const unitIdentity = z.strictObject({
    purchaseId: z.string().uuid(),
    lineId: z.string().min(1).max(100),
    unitOrdinal: z.number().int().min(1).max(1000),
});

export class GardenPackConflictError extends Error {
    override readonly name = 'GardenPackConflictError';
}
export class GardenPackNotFoundError extends Error {
    override readonly name = 'GardenPackNotFoundError';
}

/** No availability-date filter: ownership survives catalogue and season expiry. */
export async function getPurchasedGardenPack(
    accountId: string,
    purchaseId: string,
    database: Database = storage(),
) {
    ownerId.parse(accountId);
    z.string().uuid().parse(purchaseId);
    const [purchase] = await database
        .select()
        .from(gardenPackPurchases)
        .where(
            and(
                eq(gardenPackPurchases.accountId, accountId),
                eq(gardenPackPurchases.id, purchaseId),
            ),
        )
        .limit(1);
    if (!purchase) return undefined;
    const units = await database
        .select()
        .from(gardenPackUnits)
        .where(eq(gardenPackUnits.purchaseId, purchase.id))
        .orderBy(asc(gardenPackUnits.lineId), asc(gardenPackUnits.unitOrdinal));
    const remainingQuantity = units.filter(
        (unit) => unit.state === 'available',
    ).length;
    return {
        ...purchase,
        snapshot: gardenPackProductSnapshotSchema.parse(purchase.snapshot),
        units,
        remainingQuantity,
        state:
            remainingQuantity === units.length
                ? 'unopened'
                : remainingQuantity === 0
                  ? 'exhausted'
                  : 'partially-used',
    };
}

export async function listPurchasedGardenPacks(
    accountId: string,
    options: { limit?: number; offset?: number } = {},
    database: Database = storage(),
) {
    ownerId.parse(accountId);
    const limit = z
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(options.limit ?? 50);
    const offset = z
        .number()
        .int()
        .min(0)
        .max(1_000_000)
        .parse(options.offset ?? 0);
    return database
        .select({
            id: gardenPackPurchases.id,
            productId: gardenPackPurchases.productId,
            productVersionId: gardenPackPurchases.productVersionId,
            createdAt: gardenPackPurchases.createdAt,
        })
        .from(gardenPackPurchases)
        .where(eq(gardenPackPurchases.accountId, accountId))
        .orderBy(
            asc(gardenPackPurchases.createdAt),
            asc(gardenPackPurchases.id),
        )
        .limit(limit)
        .offset(offset);
}

/**
 * Internal grant primitive, NOT a public purchase service. Purchases debit the wallet
 * in this transaction under the account-economic lock. The separate cosmetic
 * activity authority may grant a validated finite zero-paid/zero-recycling reward
 * under the account deletion fence. Every caller validates trusted server contents;
 * this primitive supplies no catalogue, campaign, or client-facing grant authority.
 */
export async function recordPurchasedGardenPack(
    accountId: string,
    requestOperationId: string,
    productSnapshot: unknown,
    transaction: GardenPackTransaction,
) {
    ownerId.parse(accountId);
    operationId.parse(requestOperationId);
    const snapshot = gardenPackProductSnapshotSchema.parse(productSnapshot);
    if (!(await lockAccountAndAssertNotDeleting(accountId, transaction)))
        throw new AccountNotFoundError(accountId);
    const [existing] = await transaction
        .select()
        .from(gardenPackPurchases)
        .where(
            and(
                eq(gardenPackPurchases.accountId, accountId),
                eq(gardenPackPurchases.operationId, requestOperationId),
            ),
        )
        .limit(1);
    if (existing) {
        if (!isDeepStrictEqual(existing.snapshot, snapshot))
            throw new GardenPackConflictError(
                'Purchase operation has different contents',
            );
        return { purchaseId: existing.id, replayed: true };
    }
    await transaction
        .insert(gardenPackProductVersions)
        .values({ id: snapshot.productVersionId, snapshot })
        .onConflictDoNothing();
    const [version] = await transaction
        .select()
        .from(gardenPackProductVersions)
        .where(eq(gardenPackProductVersions.id, snapshot.productVersionId))
        .limit(1);
    if (!version || !isDeepStrictEqual(version.snapshot, snapshot))
        throw new GardenPackConflictError(
            'Product version has different contents',
        );
    const purchaseId = randomUUID();
    await transaction.insert(gardenPackPurchases).values({
        id: purchaseId,
        accountId,
        operationId: requestOperationId,
        productId: snapshot.productId,
        productVersionId: snapshot.productVersionId,
        contractVersion: snapshot.contractVersion,
        chargedSunflowers: snapshot.chargedSunflowers,
        snapshot,
    });
    await transaction.insert(gardenPackUnits).values(
        getGardenPackUnits(snapshot).map((unit) => ({
            purchaseId,
            lineId: unit.lineId,
            unitOrdinal: unit.unitOrdinal,
            paidSunflowers: unit.paidSunflowers,
            recyclingSunflowers: unit.recyclingSunflowers,
        })),
    );
    return { purchaseId, replayed: false };
}

const transitionSchema = z.discriminatedUnion('kind', [
    unitIdentity.extend({
        operationId,
        kind: z.literal('placed'),
        gardenId: z.number().int().positive(),
        blockId: z.string().min(1).max(128),
    }),
    unitIdentity.extend({ operationId, kind: z.literal('refunded') }),
    unitIdentity.extend({ operationId, kind: z.literal('recycled') }),
]);
export type GardenPackUnitTransition = z.infer<typeof transitionSchema>;

/** Caller atomically places/removes the block or credits the wallet in this tx. */
export async function transitionPurchasedGardenPackUnit(
    accountId: string,
    input: GardenPackUnitTransition,
    transaction: GardenPackTransaction,
) {
    ownerId.parse(accountId);
    const command = transitionSchema.parse(input);
    if (!(await lockAccountAndAssertNotDeleting(accountId, transaction)))
        throw new AccountNotFoundError(accountId);
    const [purchase] = await transaction
        .select({ id: gardenPackPurchases.id })
        .from(gardenPackPurchases)
        .where(
            and(
                eq(gardenPackPurchases.accountId, accountId),
                eq(gardenPackPurchases.id, command.purchaseId),
            ),
        )
        .for('update')
        .limit(1);
    if (!purchase)
        throw new GardenPackNotFoundError('Purchased pack not found');
    const [existing] = await transaction
        .select()
        .from(gardenPackUnitEvents)
        .where(
            and(
                eq(gardenPackUnitEvents.accountId, accountId),
                eq(gardenPackUnitEvents.operationId, command.operationId),
            ),
        )
        .limit(1);
    if (existing) {
        if (
            existing.purchaseId !== command.purchaseId ||
            existing.lineId !== command.lineId ||
            existing.unitOrdinal !== command.unitOrdinal ||
            existing.kind !== command.kind ||
            (command.kind === 'placed' &&
                (existing.gardenId !== command.gardenId ||
                    existing.blockId !== command.blockId))
        )
            throw new GardenPackConflictError(
                'Unit operation has different contents',
            );
        return { event: existing, replayed: true };
    }
    const unitWhere = and(
        eq(gardenPackUnits.purchaseId, command.purchaseId),
        eq(gardenPackUnits.lineId, command.lineId),
        eq(gardenPackUnits.unitOrdinal, command.unitOrdinal),
    );
    const [unit] = await transaction
        .select()
        .from(gardenPackUnits)
        .where(unitWhere)
        .for('update')
        .limit(1);
    if (!unit) throw new GardenPackNotFoundError('Purchased unit not found');
    if (unit.state !== (command.kind === 'recycled' ? 'placed' : 'available'))
        throw new GardenPackConflictError(
            'Unit is not available for this transition',
        );
    if (command.kind === 'placed') {
        const [garden] = await transaction
            .select({ id: gardens.id })
            .from(gardens)
            .where(
                and(
                    eq(gardens.id, command.gardenId),
                    eq(gardens.accountId, accountId),
                    eq(gardens.isDeleted, false),
                    eq(gardens.isSandbox, false),
                ),
            )
            .for('update')
            .limit(1);
        if (!garden)
            throw new GardenPackNotFoundError(
                'Owned active ordinary garden not found',
            );
    }
    const provenance =
        command.kind === 'placed'
            ? { gardenId: command.gardenId, blockId: command.blockId }
            : { gardenId: unit.gardenId, blockId: unit.blockId };
    const [event] = await transaction
        .insert(gardenPackUnitEvents)
        .values({
            id: randomUUID(),
            accountId,
            purchaseId: command.purchaseId,
            lineId: command.lineId,
            unitOrdinal: command.unitOrdinal,
            operationId: command.operationId,
            kind: command.kind,
            creditedSunflowers:
                command.kind === 'placed'
                    ? 0
                    : command.kind === 'refunded'
                      ? unit.paidSunflowers
                      : unit.recyclingSunflowers,
            ...provenance,
        })
        .returning();
    if (!event) throw new Error('Garden pack transition audit was not created');
    await transaction
        .update(gardenPackUnits)
        .set({ state: command.kind, ...provenance })
        .where(unitWhere);
    return { event, replayed: false };
}

export async function getPurchasedGardenPackAudit(
    accountId: string,
    purchaseId: string,
    database: Database = storage(),
) {
    ownerId.parse(accountId);
    z.string().uuid().parse(purchaseId);
    return database
        .select({
            id: gardenPackUnitEvents.id,
            lineId: gardenPackUnitEvents.lineId,
            unitOrdinal: gardenPackUnitEvents.unitOrdinal,
            kind: gardenPackUnitEvents.kind,
            creditedSunflowers: gardenPackUnitEvents.creditedSunflowers,
            gardenId: gardenPackUnitEvents.gardenId,
            blockId: gardenPackUnitEvents.blockId,
            createdAt: gardenPackUnitEvents.createdAt,
        })
        .from(gardenPackUnitEvents)
        .innerJoin(
            gardenPackPurchases,
            eq(gardenPackPurchases.id, gardenPackUnitEvents.purchaseId),
        )
        .where(
            and(
                eq(gardenPackPurchases.accountId, accountId),
                eq(gardenPackPurchases.id, purchaseId),
            ),
        )
        .orderBy(
            asc(gardenPackUnitEvents.createdAt),
            asc(gardenPackUnitEvents.id),
        );
}
