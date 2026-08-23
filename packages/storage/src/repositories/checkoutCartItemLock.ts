import { sql } from 'drizzle-orm';
import { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
export type CheckoutCartItemLockTransaction = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
export type CheckoutCartItemLockDatabase = CheckoutCartItemLockTransaction;

const checkoutCartItemDatabaseLockTails = new Map<number, Promise<void>>();
const checkoutCartItemProcessingLockTails = new Map<number, Promise<void>>();

function isPgliteTestDatabase() {
    return (
        process.env.TEST_ENV === '1' &&
        process.env.GREDICE_TEST_DB_PROVIDER === 'pglite'
    );
}

function normalizeCartItemIds(cartItemIds: readonly number[]) {
    const uniqueIds = new Set<number>();
    for (const cartItemId of cartItemIds) {
        if (!Number.isSafeInteger(cartItemId) || cartItemId <= 0) {
            throw new RangeError(
                'Checkout cart item lock requires a positive safe integer ID',
            );
        }
        uniqueIds.add(cartItemId);
    }
    return Array.from(uniqueIds).sort((left, right) => left - right);
}

async function withCheckoutCartItemInProcessLock<T>(
    lockTails: Map<number, Promise<void>>,
    cartItemId: number,
    operation: () => Promise<T>,
) {
    const previous = lockTails.get(cartItemId) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    lockTails.set(cartItemId, tail);

    await previous;
    try {
        return await operation();
    } finally {
        release();
        if (lockTails.get(cartItemId) === tail) {
            lockTails.delete(cartItemId);
        }
    }
}

function withCheckoutCartItemInProcessLocks<T>(
    lockTails: Map<number, Promise<void>>,
    cartItemIds: readonly number[],
    operation: () => Promise<T>,
): Promise<T> {
    const [cartItemId, ...remainingIds] = cartItemIds;
    if (cartItemId === undefined) {
        return operation();
    }

    return withCheckoutCartItemInProcessLock(lockTails, cartItemId, () =>
        withCheckoutCartItemInProcessLocks(lockTails, remainingIds, operation),
    );
}

/**
 * Prevents duplicate checkout callbacks in this process without retaining a
 * database connection while fulfillment performs non-database work. Durable
 * effects must still use the transaction-scoped checkout-item lock below.
 */
export function withCheckoutCartItemProcessingLocks<T>(
    cartItemIds: readonly number[],
    operation: () => Promise<T>,
) {
    return withCheckoutCartItemInProcessLocks(
        checkoutCartItemProcessingLockTails,
        normalizeCartItemIds(cartItemIds),
        operation,
    );
}

export function withCheckoutCartItemProcessingLock<T>(
    cartItemId: number,
    operation: () => Promise<T>,
) {
    return withCheckoutCartItemProcessingLocks([cartItemId], operation);
}

/**
 * Serializes checkout effects and cart mutations for a deterministic set of
 * cart items. Callers acquire this checkout-item lock before inventory,
 * account, or row locks. PostgreSQL transactions retain cross-instance
 * advisory locks; PGlite tests use the equivalent process-local keyed mutex.
 */
export async function withCheckoutCartItemLocks<T>(
    cartItemIds: readonly number[],
    operation: (db: CheckoutCartItemLockTransaction) => Promise<T>,
    transaction?: CheckoutCartItemLockTransaction,
) {
    const normalizedCartItemIds = normalizeCartItemIds(cartItemIds);
    if (isPgliteTestDatabase()) {
        return withCheckoutCartItemInProcessLocks(
            checkoutCartItemDatabaseLockTails,
            normalizedCartItemIds,
            () =>
                transaction
                    ? operation(transaction)
                    : storage().transaction(operation),
        );
    }

    const runInTransaction = async (db: CheckoutCartItemLockTransaction) => {
        for (const cartItemId of normalizedCartItemIds) {
            await db.execute(
                sql`select pg_advisory_xact_lock(hashtext(${`checkout-cart-item:${cartItemId.toString()}`}));`,
            );
        }
        return operation(db);
    };
    return transaction
        ? runInTransaction(transaction)
        : storage().transaction(runInTransaction);
}

export async function withCheckoutCartItemLock<T>(
    cartItemId: number,
    operation: (db: CheckoutCartItemLockTransaction) => Promise<T>,
    transaction?: CheckoutCartItemLockTransaction,
) {
    return withCheckoutCartItemLocks([cartItemId], operation, transaction);
}
