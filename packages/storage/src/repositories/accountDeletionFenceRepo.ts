import { and, eq } from 'drizzle-orm';
import { accounts, events } from '../schema';
import { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
export type AccountDeletionFenceTransaction = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];

const accountDeletionFenceLockTails = new Map<string, Promise<void>>();

export const accountDeletionStartedEventType = 'account.deletion.started';

export class AccountDeletionInProgressError extends Error {
    override readonly name = 'AccountDeletionInProgressError';

    constructor(readonly accountId: string) {
        super('The account is being deleted.');
    }
}

export class AccountNotFoundError extends Error {
    override readonly name = 'AccountNotFoundError';

    constructor(readonly accountId: string) {
        super('The account was not found.');
    }
}

function isPgliteTestDatabase() {
    return (
        process.env.TEST_ENV === '1' &&
        process.env.GREDICE_TEST_DB_PROVIDER === 'pglite'
    );
}

function accountDeletionFenceLockKey(accountId: string) {
    const normalizedAccountId = accountId.trim();
    if (!normalizedAccountId) {
        throw new Error('Account deletion fence requires an account ID');
    }
    return normalizedAccountId;
}

async function withAccountDeletionFenceInProcessLock<T>(
    key: string,
    callback: () => Promise<T>,
) {
    const previous =
        accountDeletionFenceLockTails.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    accountDeletionFenceLockTails.set(key, tail);

    await previous;
    try {
        return await callback();
    } finally {
        release();
        if (accountDeletionFenceLockTails.get(key) === tail) {
            accountDeletionFenceLockTails.delete(key);
        }
    }
}

export async function lockAccountForDeletionLifecycle(
    accountId: string,
    db: AccountDeletionFenceTransaction,
) {
    const [account] = await db
        .select({
            id: accounts.id,
            stripeCustomerId: accounts.stripeCustomerId,
        })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .for('update')
        .limit(1);
    return account;
}

async function hasAccountDeletionStarted(
    accountId: string,
    db: AccountDeletionFenceTransaction,
) {
    const event = await db.query.events.findFirst({
        columns: { id: true },
        where: and(
            eq(events.aggregateId, accountId),
            eq(events.type, accountDeletionStartedEventType),
        ),
    });
    return event !== undefined;
}

export async function lockAccountAndAssertNotDeleting(
    accountId: string,
    db: AccountDeletionFenceTransaction,
) {
    const account = await lockAccountForDeletionLifecycle(accountId, db);
    if (!account) {
        return undefined;
    }
    if (await hasAccountDeletionStarted(accountId, db)) {
        throw new AccountDeletionInProgressError(accountId);
    }
    return account;
}

/**
 * Run account-scoped mutations behind the durable account deletion fence.
 * PostgreSQL serializes callers through the account row lock; embedded
 * PGlite tests use a keyed process-local lock because they share one client.
 * An injected transaction is always reused so the fence and caller mutation
 * commit or roll back together.
 */
export async function withAccountDeletionFenceTransaction<T>(
    accountId: string,
    callback: (transaction: AccountDeletionFenceTransaction) => Promise<T>,
    transaction?: AccountDeletionFenceTransaction,
) {
    const lockKey = accountDeletionFenceLockKey(accountId);
    const runInTransaction = async (
        db: AccountDeletionFenceTransaction,
    ): Promise<T> => {
        const account = await lockAccountAndAssertNotDeleting(accountId, db);
        if (!account) {
            throw new AccountNotFoundError(accountId);
        }
        return callback(db);
    };
    const run = () =>
        transaction
            ? runInTransaction(transaction)
            : storage().transaction(runInTransaction);

    return isPgliteTestDatabase()
        ? withAccountDeletionFenceInProcessLock(lockKey, run)
        : run();
}

export async function markAccountDeletionStarted(
    accountId: string,
    db: AccountDeletionFenceTransaction,
) {
    if (await hasAccountDeletionStarted(accountId, db)) {
        return false;
    }
    await db.insert(events).values({
        aggregateId: accountId,
        data: {},
        type: accountDeletionStartedEventType,
        version: 1,
    });
    return true;
}
