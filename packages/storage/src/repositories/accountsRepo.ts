import 'server-only';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { accounts, accountUsers, ensureAccountAchievement, storage } from '..';
import {
    createEvent,
    getEvents,
    knownEvents,
    knownEventTypes,
} from './eventsRepo';

interface SunflowerEventData {
    amount: number;
    reason?: string;
}

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
    });
}

export async function createAccount() {
    const account = storage()
        .insert(accounts)
        .values({
            id: randomUUID(),
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

export async function getSunflowers(accountId: string) {
    // Calculate sunflowers based on events
    let currentSunflowers = 0;
    const events = await getEvents(
        [
            knownEventTypes.accounts.earnSunflowers,
            knownEventTypes.accounts.spendSunflowers,
        ],
        [accountId],
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

export async function getSunflowersHistory(
    accountId: string,
    offset: number = 0,
    limit: number = 10,
) {
    const earnEvents = await getEvents(
        [
            knownEventTypes.accounts.earnSunflowers,
            knownEventTypes.accounts.spendSunflowers,
        ],
        [accountId],
        offset,
        limit,
    );
    return earnEvents.reverse().map((event) => {
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
) {
    if (amount === 0) return;
    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1(accountId, { amount, reason }),
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
) {
    const currentSunflowers = await getSunflowers(accountId);
    if (currentSunflowers < amount) {
        throw new Error('Insufficient sunflowers');
    }

    await createEvent(
        knownEvents.accounts.sunflowersSpentV1(accountId, { amount, reason }),
    );
}
