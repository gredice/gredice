import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { events, gardenBlocks, gardenMutationOperations } from '../schema';
import { storage } from '../storage';
import { knownEventTypes } from './events';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = TransactionClient | StorageClient;

export type LegacyGardenBlockPaidSunflowersInput = Readonly<{
    accountId: string;
    blockId: string;
    gardenId: number;
}>;

/**
 * The debit reason written by the single block purchase for one garden
 * mutation receipt (`purchaseGardenBlockService`).
 */
export function gardenBlockPurchaseDebitReason(
    gardenId: number,
    operationId: string,
) {
    return `gardenBlock:${gardenId.toString()}:purchase:${operationId}`;
}

const legacyGardenBlockPurchaseDebitReasonPrefix = 'block:';

/**
 * The debit reason of every block purchase made before purchases had
 * receipts (until 2026-08-30). It names the block type, not the block.
 */
export function legacyGardenBlockPurchaseDebitReason(blockName: string) {
    return `${legacyGardenBlockPurchaseDebitReasonPrefix}${blockName}`;
}

/**
 * How far from `garden_blocks.created_at` a legacy purchase debit can lie.
 * The old purchase request created the block and debited `block:<name>` in
 * one go: in parallel until April 2026, then right after the block insert
 * and the stack update. A minute covers slow requests, and the price of one
 * block type does not change within it.
 */
export const legacyGardenBlockPurchaseDebitWindowSeconds = 60;

function parsePaidAmount(value: unknown) {
    const amount =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim()
              ? Number(value)
              : Number.NaN;
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function lowestPaidAmount(debits: readonly Readonly<{ amount: unknown }>[]) {
    let paidSunflowers: number | null = null;
    for (const debit of debits) {
        const amount = parsePaidAmount(debit.amount);
        if (amount !== null) {
            paidSunflowers =
                paidSunflowers === null
                    ? amount
                    : Math.min(paidSunflowers, amount);
        }
    }
    return paidSunflowers;
}

/**
 * Recover what was paid for a legacy block (one stored before
 * `garden_blocks.paid_sunflowers` existed) from purchase records:
 *
 * 1. Exact: the garden's `block-purchase` receipt whose stored response
 *    names the block, and the owner's Sunflower debit for that operation.
 * 2. Before receipts (until 2026-08-30) a purchase debited `block:<name>`,
 *    with no block ID, in the same request that created the block. Without
 *    an exact record, the owner's `block:<name>` debits within
 *    `legacyGardenBlockPurchaseDebitWindowSeconds` of the block's
 *    `created_at` are used. Another block of the same type bought in that
 *    window cost the same, and callers only use the result to lower a
 *    refund (min(current price, recovered price)), so the lowest amount is
 *    returned.
 *
 * Returns null when nothing is found: sandbox purchases never debit, free
 * blocks were never bought, and a failed legacy debit left no record.
 * Callers then keep the legacy refund rule. Read-only; call it inside the
 * recycling transaction, before the block is deleted.
 */
export async function getLegacyGardenBlockPaidSunflowers(
    input: LegacyGardenBlockPaidSunflowersInput,
    db: DatabaseClient = storage(),
): Promise<number | null> {
    const { accountId, blockId, gardenId } = input;
    if (
        !Number.isSafeInteger(gardenId) ||
        gardenId <= 0 ||
        !accountId ||
        !blockId
    ) {
        return null;
    }
    return (
        (await getReceiptPaidSunflowers(input, db)) ??
        (await getLegacyDebitPaidSunflowers(input, db))
    );
}

async function getReceiptPaidSunflowers(
    { accountId, blockId, gardenId }: LegacyGardenBlockPaidSunflowersInput,
    db: DatabaseClient,
) {
    const receipts = await db
        .select({ operationId: gardenMutationOperations.operationId })
        .from(gardenMutationOperations)
        .where(
            and(
                eq(gardenMutationOperations.gardenId, gardenId),
                eq(gardenMutationOperations.kind, 'block-purchase'),
                eq(
                    sql<string>`${gardenMutationOperations.response}->>'id'`,
                    blockId,
                ),
            ),
        );
    if (receipts.length === 0) {
        return null;
    }

    const debits = await db
        .select({ amount: sql<unknown>`${events.data}->'amount'` })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.accounts.spendSunflowers),
                inArray(
                    sql<string>`${events.data}->>'reason'`,
                    receipts.map((receipt) =>
                        gardenBlockPurchaseDebitReason(
                            gardenId,
                            receipt.operationId,
                        ),
                    ),
                ),
            ),
        );
    return lowestPaidAmount(debits);
}

async function getLegacyDebitPaidSunflowers(
    { accountId, blockId, gardenId }: LegacyGardenBlockPaidSunflowersInput,
    db: DatabaseClient,
) {
    const window = sql.raw(
        `interval '${legacyGardenBlockPurchaseDebitWindowSeconds.toString()} seconds'`,
    );
    const debits = await db
        .select({ amount: sql<unknown>`${events.data}->'amount'` })
        .from(gardenBlocks)
        .innerJoin(
            events,
            and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.accounts.spendSunflowers),
                sql`${events.data}->>'reason' = (${legacyGardenBlockPurchaseDebitReasonPrefix}::text || ${gardenBlocks.name})`,
                sql`${events.createdAt} between ${gardenBlocks.createdAt} - ${window} and ${gardenBlocks.createdAt} + ${window}`,
            ),
        )
        .where(
            and(
                eq(gardenBlocks.id, blockId),
                eq(gardenBlocks.gardenId, gardenId),
            ),
        );
    return lowestPaidAmount(debits);
}
