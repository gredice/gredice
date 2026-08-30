import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
    accounts,
    accountUsers,
    ensureAccountAchievement,
    events,
    storage,
} from '..';
import { lockAccountAndAssertNotDeleting } from './accountDeletionFenceRepo';
import {
    createEvent,
    getAllEvents,
    getLastBirthdayRewardEvent,
    knownEvents,
    knownEventTypes,
} from './eventsRepo';
import { hasActiveStripeCheckoutAttemptForAccount } from './stripeCheckoutAttemptRepo';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

const sunflowerAccountLockTails = new Map<string, Promise<void>>();

function isPgliteTestDatabase() {
    return (
        process.env.TEST_ENV === '1' &&
        process.env.GREDICE_TEST_DB_PROVIDER === 'pglite'
    );
}

function sunflowerAccountLockKey(accountId: string) {
    const normalizedAccountId = accountId.trim();
    if (!normalizedAccountId) {
        throw new Error('Sunflower account lock requires an account ID');
    }
    return `account-sunflowers:${normalizedAccountId}`;
}

async function withSunflowerInProcessLock<T>(
    key: string,
    callback: () => Promise<T>,
) {
    const previous = sunflowerAccountLockTails.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    sunflowerAccountLockTails.set(key, tail);

    await previous;
    try {
        return await callback();
    } finally {
        release();
        if (sunflowerAccountLockTails.get(key) === tail) {
            sunflowerAccountLockTails.delete(key);
        }
    }
}

async function lockSunflowerAccount(
    accountId: string,
    transaction: TransactionClient,
) {
    const key = sunflowerAccountLockKey(accountId);
    await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${key}));`,
    );
}

/**
 * Run account-currency work while holding the lock used by every idempotent
 * Sunflower debit and credit. Call this before a garden placement lock so
 * commercial building commands have one global lock order.
 */
export async function withSunflowerAccountTransaction<T>(
    accountId: string,
    callback: (transaction: TransactionClient) => Promise<T>,
    transaction?: TransactionClient,
) {
    const key = sunflowerAccountLockKey(accountId);
    const runInTransaction = async (db: TransactionClient) => {
        if (!isPgliteTestDatabase()) {
            await lockSunflowerAccount(accountId, db);
        }
        return callback(db);
    };
    const run = () =>
        transaction
            ? runInTransaction(transaction)
            : storage().transaction(runInTransaction);

    return isPgliteTestDatabase()
        ? withSunflowerInProcessLock(key, run)
        : run();
}

interface SunflowerEventData {
    amount: number;
    amountIsValid: boolean;
    coveredAmount?: number;
    coveredAmountIsValid: boolean;
    legacyCartReason?: string;
    legacyRewardAlreadyEarned: boolean;
    reason?: string;
}

export class InsufficientSunflowersError extends Error {
    override readonly name = 'InsufficientSunflowersError';

    constructor(
        readonly availableAmount: number,
        readonly requiredAmount: number,
    ) {
        super('Insufficient sunflowers');
    }
}

export class SunflowerSpendAmountConflictError extends Error {
    override readonly name = 'SunflowerSpendAmountConflictError';

    constructor(
        readonly reason: string,
        readonly existingAmount: number,
        readonly requestedAmount: number,
    ) {
        super('Sunflower spend amount conflicts with an existing event');
    }
}

export class SunflowerEarnAmountConflictError extends Error {
    override readonly name = 'SunflowerEarnAmountConflictError';

    constructor(
        readonly reason: string,
        readonly existingAmount: number,
        readonly requestedAmount: number,
    ) {
        super('Sunflower earn amount conflicts with an existing event');
    }
}

export type SunflowerSpendBatchItem = {
    amount: number;
    reason: string;
};

export type LegacySunflowerCartSpendCoveredItem = SunflowerSpendBatchItem & {
    cartItemId: number;
    createdAt: Date;
    paymentState: 'paid' | 'pending';
};

export type SunflowerSpendBatchResult = {
    createdReasons: string[];
    existingReasons: string[];
    resolvedAmountsByReason: Record<string, number>;
};

export type SunflowerSpendBatchOptions = {
    existingCheckoutItemAmountsAreAuthoritative?: boolean;
    legacyCartSpend?: {
        reason: string;
        coveredItems: readonly LegacySunflowerCartSpendCoveredItem[];
    };
};

export type SunflowerPaymentRewardOptions = {
    legacyRewardAlreadyEarned?: boolean;
};

export type BirthdaySunflowerGrantResult =
    | {
          status: 'created';
          accountId: string;
      }
    | {
          status: 'existing';
          accountId: string;
      };

function parseSunflowerEventData(data: unknown): SunflowerEventData {
    if (!data || typeof data !== 'object') {
        return {
            amount: 0,
            amountIsValid: false,
            coveredAmountIsValid: false,
            legacyRewardAlreadyEarned: false,
        };
    }

    const record = data as Record<string, unknown>;
    const parsedAmount = parseSunflowerEventAmount(record.amount);
    const parsedCoveredAmount = parseSunflowerEventAmount(record.coveredAmount);

    const reasonValue = record.reason;
    const legacyCartReasonValue = record.legacyCartReason;
    return {
        amount: parsedAmount.amount,
        amountIsValid: parsedAmount.isValid,
        ...(parsedCoveredAmount.isValid
            ? { coveredAmount: parsedCoveredAmount.amount }
            : {}),
        coveredAmountIsValid: parsedCoveredAmount.isValid,
        legacyCartReason:
            typeof legacyCartReasonValue === 'string'
                ? legacyCartReasonValue
                : undefined,
        legacyRewardAlreadyEarned: record.legacyRewardAlreadyEarned === true,
        reason: typeof reasonValue === 'string' ? reasonValue : undefined,
    };
}

function parseSunflowerEventAmount(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return { amount: value, isValid: true };
    }
    if (typeof value === 'string' && value.trim()) {
        const amount = Number(value);
        if (Number.isFinite(amount)) {
            return { amount, isValid: true };
        }
    }
    return { amount: 0, isValid: false };
}

export function getAccounts() {
    return storage().query.accounts.findMany({
        with: {
            accountUsers: {
                with: {
                    user: true,
                },
            },
        },
        orderBy: desc(accounts.createdAt),
    });
}

export function getAccount(accountId: string) {
    return storage().query.accounts.findFirst({
        where: eq(accounts.id, accountId),
        with: {
            accountUsers: {
                with: {
                    user: true,
                },
            },
        },
    });
}

export function getAccountUsers(accountId: string) {
    return storage().query.accountUsers.findMany({
        where: eq(accountUsers.accountId, accountId),
        with: {
            user: true,
        },
        orderBy: asc(accountUsers.createdAt),
    });
}

export async function createAccount(
    timeZone?: string,
    db: DatabaseClient = storage(),
) {
    const account = db
        .insert(accounts)
        .values({
            id: randomUUID(),
            ...(timeZone && { timeZone }),
        })
        .returning({ id: accounts.id });
    const accountId = (await account)[0].id;
    if (!accountId) {
        throw new Error('Failed to create account');
    }

    await createEvent(knownEvents.accounts.createdV1(accountId), db);
    await ensureAccountAchievement(
        accountId,
        'registration',
        {
            earnedAt: new Date(),
            autoApprove: true,
        },
        db,
    );

    return accountId;
}

export async function assignStripeCustomerId(
    accountId: string,
    stripeCustomerId: string,
) {
    const result = await storage()
        .update(accounts)
        .set({ stripeCustomerId })
        .where(eq(accounts.id, accountId))
        .returning();
    return result[0];
}

export async function assignStripeCustomerIdIfUnchanged(
    accountId: string,
    expectedStripeCustomerId: string | null | undefined,
    candidateStripeCustomerId: string,
) {
    return storage().transaction(async (db) => {
        const account = await lockAccountAndAssertNotDeleting(accountId, db);
        if (!account) {
            return undefined;
        }
        const expectedCustomerId = expectedStripeCustomerId ?? null;
        if (account.stripeCustomerId !== expectedCustomerId) {
            return account.stripeCustomerId ?? undefined;
        }
        if (account.stripeCustomerId === candidateStripeCustomerId) {
            return candidateStripeCustomerId;
        }
        if (
            account.stripeCustomerId &&
            (await hasActiveStripeCheckoutAttemptForAccount(accountId, db))
        ) {
            return account.stripeCustomerId;
        }
        const [updated] = await db
            .update(accounts)
            .set({ stripeCustomerId: candidateStripeCustomerId })
            .where(eq(accounts.id, accountId))
            .returning({ stripeCustomerId: accounts.stripeCustomerId });
        return updated?.stripeCustomerId ?? undefined;
    });
}

export async function updateAccountTimeZone(
    accountId: string,
    timeZone: string,
) {
    const result = await storage()
        .update(accounts)
        .set({ timeZone })
        .where(eq(accounts.id, accountId))
        .returning();
    return result[0];
}

export async function getSunflowers(
    accountId: string,
    db: DatabaseClient = storage(),
) {
    // Calculate sunflowers based on events
    let currentSunflowers = 0;
    const events = await getAllEvents(
        [
            knownEventTypes.accounts.earnSunflowers,
            knownEventTypes.accounts.earnSunflowerDrop,
            knownEventTypes.accounts.spendSunflowers,
        ],
        [accountId],
        { db },
    );
    for (const event of events) {
        const { amount } = parseSunflowerEventData(event.data);
        currentSunflowers +=
            event.type === knownEventTypes.accounts.spendSunflowers
                ? -amount
                : amount;
    }
    return currentSunflowers;
}

function startOfUtcDay(date: Date) {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
}

export async function grantBirthdaySunflowers({
    accountId,
    amount,
    isLate,
    rewardDate,
    userId,
}: {
    accountId: string;
    amount: number;
    isLate: boolean;
    rewardDate: Date;
    userId: string;
}): Promise<BirthdaySunflowerGrantResult> {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(
            'Birthday sunflower amount must be a positive integer.',
        );
    }

    const normalizedRewardDate = startOfUtcDay(rewardDate);
    const rewardYear = normalizedRewardDate.getUTCFullYear();
    const reason = `birthday:${rewardYear.toString()}`;

    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`birthday-reward:${userId}:${rewardYear.toString()}`}));`,
        );

        const lastRewardEvent = await getLastBirthdayRewardEvent(userId, tx);
        const lastRewardDate = lastRewardEvent
            ? startOfUtcDay(new Date(lastRewardEvent.data.rewardDate))
            : null;
        if (lastRewardDate?.getUTCFullYear() === rewardYear) {
            return {
                status: 'existing',
                accountId,
            };
        }

        await earnSunflowers(accountId, amount, reason, tx);
        await createEvent(
            knownEvents.users.birthdayRewardV1(userId, {
                rewardDate: normalizedRewardDate.toISOString(),
                accountId,
                amount,
                late: isLate,
            }),
            tx,
        );

        return {
            status: 'created',
            accountId,
        };
    });
}

export async function getSunflowersHistory(
    accountId: string,
    offset: number = 0,
    limit: number = 10,
) {
    const earnEvents = await storage().query.events.findMany({
        where: and(
            eq(events.aggregateId, accountId),
            inArray(events.type, [
                knownEventTypes.accounts.earnSunflowers,
                knownEventTypes.accounts.earnSunflowerDrop,
                knownEventTypes.accounts.spendSunflowers,
            ]),
            sql<boolean>`not (${events.type} in (${knownEventTypes.accounts.earnSunflowers}, ${knownEventTypes.accounts.spendSunflowers}) and ${events.data}->>'amount' = '0')`,
        ),
        orderBy: [desc(events.createdAt), desc(events.id)],
        offset,
        limit,
    });
    return earnEvents.map((event) => {
        const { amount, reason } = parseSunflowerEventData(event.data);
        return {
            ...event,
            amount,
            reason,
        };
    });
}

export async function earnSunflowers(
    accountId: string,
    amount: number,
    reason: string,
    db: DatabaseClient = storage(),
) {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error('Sunflower earn amount must be a positive integer');
    }
    if (!reason.trim()) {
        throw new Error('Sunflower earn reason is required');
    }
    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1(accountId, { amount, reason }),
        db,
    );
}

async function earnSunflowersAmountOnceInTransaction(
    accountId: string,
    amount: number,
    reason: string,
    tx: TransactionClient,
) {
    await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`account-sunflowers:${accountId}`}));`,
    );
    const existingEvents = await tx
        .select({ data: events.data })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.accounts.earnSunflowers),
                eq(sql<string>`${events.data}->>'reason'`, reason),
            ),
        );
    if (existingEvents.length > 1) {
        const existingAmount = parseSunflowerEventData(
            existingEvents[0]?.data,
        ).amount;
        throw new SunflowerEarnAmountConflictError(
            reason,
            existingAmount,
            amount,
        );
    }

    const existingEvent = existingEvents[0];
    if (existingEvent) {
        const existingAmount = parseSunflowerEventData(
            existingEvent.data,
        ).amount;
        if (existingAmount !== amount) {
            throw new SunflowerEarnAmountConflictError(
                reason,
                existingAmount,
                amount,
            );
        }
        return { status: 'existing' as const };
    }

    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1(accountId, {
            amount,
            reason,
        }),
        tx,
    );
    return { status: 'created' as const };
}

async function earnSunflowersForPaymentInTransaction(
    accountId: string,
    sunflowers: number,
    reason: string,
    tx: TransactionClient,
    options: SunflowerPaymentRewardOptions,
) {
    await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`account-sunflowers:${accountId}`}));`,
    );
    const existingEvents = await tx
        .select({ data: events.data })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.accounts.earnSunflowers),
                eq(sql<string>`${events.data}->>'reason'`, reason),
            ),
        );
    if (existingEvents.length > 1) {
        const existingAmount = parseSunflowerEventData(
            existingEvents[0]?.data,
        ).amount;
        throw new SunflowerEarnAmountConflictError(
            reason,
            existingAmount,
            sunflowers,
        );
    }

    const existingEvent = existingEvents[0];
    if (existingEvent) {
        const existingData = parseSunflowerEventData(existingEvent.data);
        const isActualReward =
            sunflowers > 0 &&
            existingData.amountIsValid &&
            existingData.amount === sunflowers &&
            !existingData.coveredAmountIsValid &&
            existingData.legacyCartReason === undefined &&
            !existingData.legacyRewardAlreadyEarned;
        const isZeroRewardCheckpoint =
            sunflowers === 0 &&
            existingData.amountIsValid &&
            existingData.amount === 0 &&
            !existingData.coveredAmountIsValid &&
            existingData.legacyCartReason === undefined &&
            !existingData.legacyRewardAlreadyEarned;
        const isLegacyRewardCheckpoint =
            options.legacyRewardAlreadyEarned === true &&
            sunflowers > 0 &&
            existingData.amountIsValid &&
            existingData.amount === 0 &&
            existingData.coveredAmountIsValid &&
            existingData.coveredAmount === sunflowers &&
            existingData.legacyCartReason === undefined &&
            existingData.legacyRewardAlreadyEarned;
        if (
            isActualReward ||
            isZeroRewardCheckpoint ||
            isLegacyRewardCheckpoint
        ) {
            return { status: 'existing' as const };
        }
        throw new SunflowerEarnAmountConflictError(
            reason,
            existingData.amount,
            sunflowers,
        );
    }

    const isLegacyRewardCheckpoint = options.legacyRewardAlreadyEarned === true;
    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1(accountId, {
            amount: isLegacyRewardCheckpoint ? 0 : sunflowers,
            ...(isLegacyRewardCheckpoint
                ? {
                      coveredAmount: sunflowers,
                      legacyRewardAlreadyEarned: true,
                  }
                : {}),
            reason,
        }),
        tx,
    );
    return { status: 'created' as const };
}

export async function earnSunflowersOnce(
    accountId: string,
    amount: number,
    reason: string,
    transaction?: TransactionClient,
) {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error('Sunflower earn amount must be a positive integer');
    }
    if (!reason.trim()) {
        throw new Error('Sunflower earn reason is required');
    }

    return transaction
        ? earnSunflowersAmountOnceInTransaction(
              accountId,
              amount,
              reason,
              transaction,
          )
        : storage().transaction((tx) =>
              earnSunflowersAmountOnceInTransaction(
                  accountId,
                  amount,
                  reason,
                  tx,
              ),
          );
}

export async function earnSunflowersForPayment(
    accountId: string,
    payment: number,
    idempotencyKey?: string,
    transaction?: TransactionClient,
    options: SunflowerPaymentRewardOptions = {},
) {
    // Calculate sunflowers based on payment amount
    // For every 1 unit spent, earn 10 sunflowers
    const sunflowers = Math.round(payment * 10);
    if (idempotencyKey && sunflowers >= 0) {
        const reason = `payment:${idempotencyKey}`;
        if (options.legacyRewardAlreadyEarned === true && sunflowers <= 0) {
            throw new Error(
                'Legacy sunflower payment reward must cover a positive amount',
            );
        }
        const recordReward = (tx: TransactionClient) =>
            earnSunflowersForPaymentInTransaction(
                accountId,
                sunflowers,
                reason,
                tx,
                options,
            );
        await (transaction
            ? recordReward(transaction)
            : storage().transaction(recordReward));
        return;
    }
    if (options.legacyRewardAlreadyEarned === true) {
        throw new Error(
            'Legacy sunflower payment reward requires an idempotency key',
        );
    }
    if (sunflowers > 0) {
        await earnSunflowers(accountId, sunflowers, 'payment', transaction);
    }
}

export async function spendSunflowers(
    accountId: string,
    amount: number,
    reason: string,
    db: ReturnType<typeof storage> = storage(),
) {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error('Sunflower spend amount must be a positive integer');
    }
    if (!reason.trim()) {
        throw new Error('Sunflower spend reason is required');
    }
    await db.transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`account-sunflowers:${accountId}`}));`,
        );

        const currentSunflowers = await getSunflowers(accountId, tx);
        if (currentSunflowers < amount) {
            throw new InsufficientSunflowersError(currentSunflowers, amount);
        }

        await createEvent(
            knownEvents.accounts.sunflowersSpentV1(accountId, {
                amount,
                reason,
            }),
            tx,
        );
    });
}

const checkoutCartItemSpendReasonPattern = /^shoppingCartItem:[1-9]\d*$/;
const legacyCheckoutCartSpendReasonPattern = /^shoppingCart:[1-9]\d*$/;

function normalizeSunflowerSpendBatchItems<
    Item extends SunflowerSpendBatchItem,
>(items: readonly Item[], rejectDuplicateReasons: boolean) {
    const uniqueItems = new Map<string, Item>();
    for (const item of items) {
        if (!Number.isInteger(item.amount) || item.amount <= 0) {
            throw new Error(
                'Sunflower spend amount must be a positive integer',
            );
        }
        if (!item.reason.trim()) {
            throw new Error('Sunflower spend reason is required');
        }

        const duplicate = uniqueItems.get(item.reason);
        if (duplicate && rejectDuplicateReasons) {
            throw new SunflowerSpendAmountConflictError(
                item.reason,
                duplicate.amount,
                item.amount,
            );
        }
        if (duplicate && duplicate.amount !== item.amount) {
            throw new SunflowerSpendAmountConflictError(
                item.reason,
                duplicate.amount,
                item.amount,
            );
        }
        uniqueItems.set(item.reason, item);
    }
    return uniqueItems;
}

function assertCheckoutCartItemSpendReason(reason: string) {
    if (!checkoutCartItemSpendReasonPattern.test(reason)) {
        throw new Error(
            'Checkout sunflower replay requires a shoppingCartItem:<id> reason',
        );
    }
}

/**
 * Spend sunflowers for durable, independently retryable operations.
 *
 * Each reason is an idempotency key. By default, a retry with the same amount
 * is a no-op and a changed amount is rejected. Checkout can explicitly elect
 * to use a unique stored item debit as the source of truth on replay.
 */
export async function spendSunflowersBatch(
    accountId: string,
    items: readonly SunflowerSpendBatchItem[],
    transaction?: TransactionClient,
    options: SunflowerSpendBatchOptions = {},
): Promise<SunflowerSpendBatchResult> {
    const uniqueItems = normalizeSunflowerSpendBatchItems(items, false);
    const checkoutReplayEnabled =
        options.existingCheckoutItemAmountsAreAuthoritative === true ||
        options.legacyCartSpend !== undefined;
    if (checkoutReplayEnabled) {
        for (const reason of uniqueItems.keys()) {
            assertCheckoutCartItemSpendReason(reason);
        }
    }

    const legacyCartSpend = options.legacyCartSpend;
    const coveredItems = legacyCartSpend
        ? normalizeSunflowerSpendBatchItems(legacyCartSpend.coveredItems, true)
        : undefined;
    if (legacyCartSpend) {
        if (
            !legacyCheckoutCartSpendReasonPattern.test(legacyCartSpend.reason)
        ) {
            throw new Error(
                'Legacy checkout sunflower replay requires a shoppingCart:<id> reason',
            );
        }
        if (!coveredItems || coveredItems.size === 0) {
            throw new Error(
                'Legacy checkout sunflower replay requires covered items',
            );
        }
        for (const coveredItem of coveredItems.values()) {
            assertCheckoutCartItemSpendReason(coveredItem.reason);
            if (
                !Number.isSafeInteger(coveredItem.cartItemId) ||
                coveredItem.cartItemId <= 0 ||
                coveredItem.reason !==
                    `shoppingCartItem:${coveredItem.cartItemId.toString()}`
            ) {
                throw new Error(
                    'Legacy checkout sunflower covered-item reason must match its cart item ID',
                );
            }
            if (
                !(coveredItem.createdAt instanceof Date) ||
                Number.isNaN(coveredItem.createdAt.getTime())
            ) {
                throw new Error(
                    'Legacy checkout sunflower covered item requires a valid creation time',
                );
            }
            if (
                coveredItem.paymentState !== 'paid' &&
                coveredItem.paymentState !== 'pending'
            ) {
                throw new Error(
                    'Legacy checkout sunflower covered item requires a payment state',
                );
            }
            if (
                coveredItem.paymentState === 'paid' &&
                uniqueItems.has(coveredItem.reason)
            ) {
                throw new Error(
                    'Legacy checkout sunflower paid covered item cannot be requested for debit',
                );
            }
        }
        for (const item of uniqueItems.values()) {
            const coveredItem = coveredItems.get(item.reason);
            if (!coveredItem) {
                throw new Error(
                    'Legacy checkout sunflower replay must cover every pending item',
                );
            }
            if (coveredItem.amount !== item.amount) {
                throw new SunflowerSpendAmountConflictError(
                    item.reason,
                    coveredItem.amount,
                    item.amount,
                );
            }
        }
    }

    if (uniqueItems.size === 0 && !legacyCartSpend) {
        return {
            createdReasons: [],
            existingReasons: [],
            resolvedAmountsByReason: {},
        };
    }

    const spendInTransaction = async (tx: TransactionClient) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`account-sunflowers:${accountId}`}));`,
        );

        const reasons = Array.from(
            new Set([
                ...(coveredItems?.keys() ?? uniqueItems.keys()),
                ...(legacyCartSpend ? [legacyCartSpend.reason] : []),
            ]),
        );
        const existingEvents = await tx
            .select({ createdAt: events.createdAt, data: events.data })
            .from(events)
            .where(
                and(
                    eq(events.aggregateId, accountId),
                    eq(events.type, knownEventTypes.accounts.spendSunflowers),
                    inArray(sql<string>`${events.data}->>'reason'`, reasons),
                ),
            );
        const existingEventsByReason = new Map<
            string,
            (SunflowerEventData & { createdAt: Date })[]
        >();
        for (const event of existingEvents) {
            const eventData = {
                ...parseSunflowerEventData(event.data),
                createdAt: event.createdAt,
            };
            const { reason } = eventData;
            if (!reason) continue;
            const matchingEvents = existingEventsByReason.get(reason) ?? [];
            matchingEvents.push(eventData);
            existingEventsByReason.set(reason, matchingEvents);
        }
        for (const reason of reasons) {
            const matchingEvents = existingEventsByReason.get(reason) ?? [];
            if (matchingEvents.length > 1) {
                throw new SunflowerSpendAmountConflictError(
                    reason,
                    matchingEvents[0]?.amount ?? 0,
                    uniqueItems.get(reason)?.amount ??
                        coveredItems?.get(reason)?.amount ??
                        0,
                );
            }
        }

        const resolvedCoveredAmounts = new Map<string, number>();
        if (legacyCartSpend && coveredItems) {
            const legacyEvent = existingEventsByReason.get(
                legacyCartSpend.reason,
            )?.[0];
            const existingCheckpoints = new Set<string>();
            for (const coveredItem of coveredItems.values()) {
                resolvedCoveredAmounts.set(
                    coveredItem.reason,
                    coveredItem.amount,
                );
            }

            for (const coveredItem of coveredItems.values()) {
                const existingEvent = existingEventsByReason.get(
                    coveredItem.reason,
                )?.[0];
                if (!existingEvent) continue;

                if (existingEvent.amount !== 0) {
                    const isValidExistingDebit =
                        existingEvent.amountIsValid &&
                        Number.isInteger(existingEvent.amount) &&
                        existingEvent.amount > 0 &&
                        !existingEvent.coveredAmountIsValid &&
                        existingEvent.legacyCartReason === undefined &&
                        !existingEvent.legacyRewardAlreadyEarned;
                    if (!isValidExistingDebit) {
                        throw new SunflowerSpendAmountConflictError(
                            coveredItem.reason,
                            existingEvent.amount,
                            coveredItem.amount,
                        );
                    }
                    if (legacyEvent) {
                        throw new SunflowerSpendAmountConflictError(
                            coveredItem.reason,
                            existingEvent.amount,
                            0,
                        );
                    }
                    resolvedCoveredAmounts.set(
                        coveredItem.reason,
                        existingEvent.amount,
                    );
                    continue;
                }
                const isMatchingCheckpoint =
                    existingEvent.amountIsValid &&
                    existingEvent.coveredAmountIsValid &&
                    Number.isInteger(existingEvent.coveredAmount) &&
                    (existingEvent.coveredAmount ?? 0) > 0 &&
                    existingEvent.legacyCartReason === legacyCartSpend.reason &&
                    !existingEvent.legacyRewardAlreadyEarned;
                if (!isMatchingCheckpoint || !legacyEvent) {
                    throw new SunflowerSpendAmountConflictError(
                        coveredItem.reason,
                        existingEvent.coveredAmount ?? 0,
                        coveredItem.amount,
                    );
                }
                existingCheckpoints.add(coveredItem.reason);
                resolvedCoveredAmounts.set(
                    coveredItem.reason,
                    existingEvent.coveredAmount ?? coveredItem.amount,
                );
            }

            if (legacyEvent) {
                for (const coveredItem of coveredItems.values()) {
                    if (coveredItem.createdAt > legacyEvent.createdAt) {
                        throw new Error(
                            'Legacy checkout sunflower covered item was created after the cart debit',
                        );
                    }
                }
                const coveredAmount = Array.from(
                    resolvedCoveredAmounts.values(),
                ).reduce((total, amount) => total + amount, 0);
                const isMatchingLegacyEvent =
                    legacyEvent.amountIsValid &&
                    Number.isInteger(legacyEvent.amount) &&
                    legacyEvent.amount > 0 &&
                    legacyEvent.amount === coveredAmount &&
                    !legacyEvent.coveredAmountIsValid &&
                    legacyEvent.legacyCartReason === undefined &&
                    !legacyEvent.legacyRewardAlreadyEarned;
                if (!isMatchingLegacyEvent) {
                    throw new SunflowerSpendAmountConflictError(
                        legacyCartSpend.reason,
                        legacyEvent.amount,
                        coveredAmount,
                    );
                }

                const newlyCreatedCheckpointReasons = new Set<string>();
                for (const coveredItem of coveredItems.values()) {
                    if (
                        coveredItem.paymentState !== 'paid' &&
                        !uniqueItems.has(coveredItem.reason)
                    ) {
                        continue;
                    }
                    const resolvedAmount =
                        resolvedCoveredAmounts.get(coveredItem.reason) ??
                        coveredItem.amount;
                    if (existingCheckpoints.has(coveredItem.reason)) {
                        continue;
                    }
                    await createEvent(
                        knownEvents.accounts.sunflowersSpentV1(accountId, {
                            amount: 0,
                            coveredAmount: resolvedAmount,
                            legacyCartReason: legacyCartSpend.reason,
                            reason: coveredItem.reason,
                        }),
                        tx,
                    );
                    newlyCreatedCheckpointReasons.add(coveredItem.reason);
                }
                const createdReasons = [...uniqueItems.keys()].filter(
                    (reason) => newlyCreatedCheckpointReasons.has(reason),
                );
                const existingReasons = [...uniqueItems.keys()].filter(
                    (reason) => existingCheckpoints.has(reason),
                );
                const resolvedAmounts = new Map<string, number>();
                for (const coveredItem of coveredItems.values()) {
                    if (
                        coveredItem.paymentState === 'paid' ||
                        uniqueItems.has(coveredItem.reason)
                    ) {
                        resolvedAmounts.set(
                            coveredItem.reason,
                            resolvedCoveredAmounts.get(coveredItem.reason) ??
                                coveredItem.amount,
                        );
                    }
                }
                return {
                    createdReasons,
                    existingReasons,
                    resolvedAmountsByReason:
                        Object.fromEntries(resolvedAmounts),
                };
            }

            for (const coveredItem of coveredItems.values()) {
                if (
                    coveredItem.paymentState === 'paid' &&
                    !existingEventsByReason.has(coveredItem.reason)
                ) {
                    throw new SunflowerSpendAmountConflictError(
                        coveredItem.reason,
                        0,
                        coveredItem.amount,
                    );
                }
            }
        }

        const missingItems: SunflowerSpendBatchItem[] = [];
        const existingReasons: string[] = [];
        const resolvedAmounts = new Map<string, number>();
        for (const item of uniqueItems.values()) {
            const existingEvent = existingEventsByReason.get(item.reason)?.[0];
            if (!existingEvent) {
                missingItems.push(item);
                resolvedAmounts.set(item.reason, item.amount);
                continue;
            }
            const existingAmount = existingEvent.amount;
            const isValidExistingDebit =
                existingEvent.amountIsValid &&
                Number.isInteger(existingAmount) &&
                existingAmount > 0 &&
                !existingEvent.coveredAmountIsValid &&
                existingEvent.legacyCartReason === undefined &&
                !existingEvent.legacyRewardAlreadyEarned;
            if (
                !isValidExistingDebit ||
                (existingAmount !== item.amount &&
                    options.existingCheckoutItemAmountsAreAuthoritative !==
                        true)
            ) {
                throw new SunflowerSpendAmountConflictError(
                    item.reason,
                    existingAmount,
                    item.amount,
                );
            }
            existingReasons.push(item.reason);
            resolvedAmounts.set(item.reason, existingAmount);
        }
        for (const coveredItem of coveredItems?.values() ?? []) {
            if (coveredItem.paymentState !== 'paid') {
                continue;
            }
            const resolvedAmount = resolvedCoveredAmounts.get(
                coveredItem.reason,
            );
            if (resolvedAmount === undefined) {
                throw new SunflowerSpendAmountConflictError(
                    coveredItem.reason,
                    0,
                    coveredItem.amount,
                );
            }
            resolvedAmounts.set(coveredItem.reason, resolvedAmount);
        }

        if (missingItems.length === 0) {
            return {
                createdReasons: [],
                existingReasons,
                resolvedAmountsByReason: Object.fromEntries(resolvedAmounts),
            };
        }

        const currentSunflowers = await getSunflowers(accountId, tx);
        const requiredSunflowers = missingItems.reduce(
            (total, item) => total + item.amount,
            0,
        );
        if (currentSunflowers < requiredSunflowers) {
            throw new InsufficientSunflowersError(
                currentSunflowers,
                requiredSunflowers,
            );
        }

        for (const item of missingItems) {
            await createEvent(
                knownEvents.accounts.sunflowersSpentV1(accountId, item),
                tx,
            );
        }

        return {
            createdReasons: missingItems.map((item) => item.reason),
            existingReasons,
            resolvedAmountsByReason: Object.fromEntries(resolvedAmounts),
        };
    };
    return transaction
        ? spendInTransaction(transaction)
        : storage().transaction(spendInTransaction);
}
