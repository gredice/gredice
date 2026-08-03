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
import {
    createEvent,
    getAllEvents,
    getLastBirthdayRewardEvent,
    getLatestEvents,
    knownEvents,
    knownEventTypes,
} from './eventsRepo';

interface SunflowerEventData {
    amount: number;
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

export type SunflowerSpendBatchItem = {
    amount: number;
    reason: string;
};

export type SunflowerSpendBatchResult = {
    createdReasons: string[];
    existingReasons: string[];
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
        return { amount: 0 };
    }

    const record = data as Record<string, unknown>;
    const amountValue = record.amount;
    let amount = 0;
    if (typeof amountValue === 'number') {
        amount = amountValue;
    } else if (typeof amountValue === 'string') {
        const parsed = Number.parseFloat(amountValue);
        if (!Number.isNaN(parsed)) {
            amount = parsed;
        }
    }

    const reasonValue = record.reason;
    return {
        amount,
        reason: typeof reasonValue === 'string' ? reasonValue : undefined,
    };
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

export async function createAccount(timeZone?: string) {
    const account = storage()
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

    await createEvent(knownEvents.accounts.createdV1(accountId));
    await ensureAccountAchievement(accountId, 'registration', {
        earnedAt: new Date(),
        autoApprove: true,
    });

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
    db: ReturnType<typeof storage> = storage(),
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
    const earnEvents = await getLatestEvents(
        [
            knownEventTypes.accounts.earnSunflowers,
            knownEventTypes.accounts.earnSunflowerDrop,
            knownEventTypes.accounts.spendSunflowers,
        ],
        [accountId],
        offset,
        limit,
    );
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
    db: ReturnType<typeof storage> = storage(),
) {
    if (amount === 0) return;
    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1(accountId, { amount, reason }),
        db,
    );
}

export async function earnSunflowersForPayment(
    accountId: string,
    payment: number,
) {
    // Calculate sunflowers based on payment amount
    // For every 1 unit spent, earn 10 sunflowers
    const sunflowers = Math.round(payment * 10);
    if (sunflowers > 0) {
        await earnSunflowers(accountId, sunflowers, 'payment');
    }
}

export async function spendSunflowers(
    accountId: string,
    amount: number,
    reason: string,
    db: ReturnType<typeof storage> = storage(),
) {
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

/**
 * Spend sunflowers for durable, independently retryable operations.
 *
 * Each reason is an idempotency key. A retry with the same amount is a no-op,
 * while reusing a reason for a different amount is rejected. All missing
 * debits are validated before any event is written.
 */
export async function spendSunflowersBatch(
    accountId: string,
    items: readonly SunflowerSpendBatchItem[],
    db: ReturnType<typeof storage> = storage(),
): Promise<SunflowerSpendBatchResult> {
    const uniqueItems = new Map<string, SunflowerSpendBatchItem>();
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
        if (duplicate && duplicate.amount !== item.amount) {
            throw new SunflowerSpendAmountConflictError(
                item.reason,
                duplicate.amount,
                item.amount,
            );
        }
        uniqueItems.set(item.reason, item);
    }

    if (uniqueItems.size === 0) {
        return { createdReasons: [], existingReasons: [] };
    }

    return db.transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`account-sunflowers:${accountId}`}));`,
        );

        const reasons = Array.from(uniqueItems.keys());
        const existingEvents = await tx
            .select({ data: events.data })
            .from(events)
            .where(
                and(
                    eq(events.aggregateId, accountId),
                    eq(events.type, knownEventTypes.accounts.spendSunflowers),
                    inArray(sql<string>`${events.data}->>'reason'`, reasons),
                ),
            );
        const existingAmounts = new Map<string, number>();
        for (const event of existingEvents) {
            const { amount, reason } = parseSunflowerEventData(event.data);
            if (!reason) continue;

            const previousAmount = existingAmounts.get(reason);
            if (previousAmount !== undefined && previousAmount !== amount) {
                throw new SunflowerSpendAmountConflictError(
                    reason,
                    previousAmount,
                    amount,
                );
            }
            existingAmounts.set(reason, amount);
        }

        const missingItems: SunflowerSpendBatchItem[] = [];
        const existingReasons: string[] = [];
        for (const item of uniqueItems.values()) {
            const existingAmount = existingAmounts.get(item.reason);
            if (existingAmount === undefined) {
                missingItems.push(item);
                continue;
            }
            if (existingAmount !== item.amount) {
                throw new SunflowerSpendAmountConflictError(
                    item.reason,
                    existingAmount,
                    item.amount,
                );
            }
            existingReasons.push(item.reason);
        }

        if (missingItems.length === 0) {
            return { createdReasons: [], existingReasons };
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
        };
    });
}
