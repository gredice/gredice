import { and, eq } from 'drizzle-orm';
import { accounts, events } from '../schema';
import type { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
export type AccountDeletionFenceTransaction = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];

export const accountDeletionStartedEventType = 'account.deletion.started';

export class AccountDeletionInProgressError extends Error {
    override readonly name = 'AccountDeletionInProgressError';

    constructor(readonly accountId: string) {
        super('The account is being deleted.');
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
