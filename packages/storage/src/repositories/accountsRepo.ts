import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, lte } from 'drizzle-orm';
import {
    accounts,
    accountUsers,
    ensureAccountAchievement,
    storage,
    events as storedEvents,
} from '..';
import {
    createEvent,
    getEvents,
    knownEvents,
    knownEventTypes,
} from './eventsRepo';

type DatabaseClient = ReturnType<typeof storage>;

interface SunflowerEventData {
    amount: number;
    reason?: string;
}

export const ACCOUNT_REFERRAL_EVENT_TYPE = 'account.referral.v1';

export type AccountReferralDetails = {
    myCode: string;
    usedReferralCode: string | null;
    usedReferralSourceAccountId: string | null;
    referredAccounts: Array<{
        accountId: string;
        rewarded: boolean;
    }>;
};

type AccountReferralEventData =
    | {
          action: 'code_set';
          code: string;
      }
    | {
          action: 'used_code';
          code: string;
      }
    | {
          action: 'referred_account';
          referredAccountId: string;
          rewarded: boolean;
      };

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
}

export function normalizeReferralCode(code: string) {
    return code
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 32);
}

function getDefaultReferralCode(accountId: string) {
    return normalizeReferralCode(accountId.slice(0, 12));
}

function parseAccountReferralEventData(
    data: unknown,
): AccountReferralEventData | null {
    if (!isRecord(data) || typeof data.action !== 'string') {
        return null;
    }

    if (data.action === 'code_set' && typeof data.code === 'string') {
        return {
            action: 'code_set',
            code: normalizeReferralCode(data.code),
        };
    }

    if (data.action === 'used_code' && typeof data.code === 'string') {
        return {
            action: 'used_code',
            code: normalizeReferralCode(data.code),
        };
    }

    if (
        data.action === 'referred_account' &&
        typeof data.referredAccountId === 'string'
    ) {
        return {
            action: 'referred_account',
            referredAccountId: data.referredAccountId,
            rewarded: data.rewarded === true,
        };
    }

    return null;
}

function codeFromReferralCodeSetEventData(data: unknown) {
    const eventData = parseAccountReferralEventData(data);
    return eventData?.action === 'code_set' ? eventData.code : null;
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
        orderBy: asc(accountUsers.createdAt),
    });
}

export async function getReferralCodeOwnerAccountId(
    code: string,
    db: Pick<DatabaseClient, 'select'> = storage(),
) {
    return findReferralCodeOwnerAccountId(code, db);
}

async function findReferralCodeOwnerAccountId(
    code: string,
    db: Pick<DatabaseClient, 'select'>,
    at?: Date,
) {
    const normalizedCode = normalizeReferralCode(code);
    if (!normalizedCode) {
        return null;
    }

    const [accountRows, referralEvents] = await Promise.all([
        db
            .select({ id: accounts.id, createdAt: accounts.createdAt })
            .from(accounts),
        db
            .select({
                aggregateId: storedEvents.aggregateId,
                data: storedEvents.data,
            })
            .from(storedEvents)
            .where(
                at
                    ? and(
                          eq(storedEvents.type, ACCOUNT_REFERRAL_EVENT_TYPE),
                          lte(storedEvents.createdAt, at),
                      )
                    : eq(storedEvents.type, ACCOUNT_REFERRAL_EVENT_TYPE),
            )
            .orderBy(asc(storedEvents.createdAt), asc(storedEvents.id)),
    ]);

    const currentCodes = new Map<string, string>();
    for (const account of accountRows) {
        if (at && account.createdAt.getTime() > at.getTime()) {
            continue;
        }
        currentCodes.set(account.id, getDefaultReferralCode(account.id));
    }

    for (const event of referralEvents) {
        const eventCode = codeFromReferralCodeSetEventData(event.data);
        if (eventCode) {
            currentCodes.set(event.aggregateId, eventCode);
        }
    }

    for (const [accountId, currentCode] of currentCodes) {
        if (currentCode === normalizedCode) {
            return accountId;
        }
    }

    return null;
}

export async function getAccountReferralDetails(
    accountId: string,
    options: {
        includeUsedReferralSource?: boolean;
        db?: DatabaseClient;
    } = {},
): Promise<AccountReferralDetails> {
    const db = options.db ?? storage();
    const referralEvents = await getEvents(
        ACCOUNT_REFERRAL_EVENT_TYPE,
        [accountId],
        0,
        1000,
        db,
    );

    let myCode = '';
    let usedReferralCode: string | null = null;
    let usedReferralCodeUsedAt: Date | undefined;
    const referredAccounts: AccountReferralDetails['referredAccounts'] = [];

    for (const event of referralEvents) {
        const data = parseAccountReferralEventData(event.data);
        if (!data) {
            continue;
        }

        if (data.action === 'code_set') {
            myCode = data.code;
        }

        if (data.action === 'used_code') {
            usedReferralCode = data.code;
            usedReferralCodeUsedAt = event.createdAt;
        }

        if (data.action === 'referred_account') {
            referredAccounts.push({
                accountId: data.referredAccountId,
                rewarded: data.rewarded,
            });
        }
    }

    if (!myCode) {
        myCode = getDefaultReferralCode(accountId);
    }

    const usedReferralSourceAccountId =
        options.includeUsedReferralSource && usedReferralCode
            ? await findReferralCodeOwnerAccountId(
                  usedReferralCode,
                  db,
                  usedReferralCodeUsedAt,
              )
            : null;

    return {
        myCode,
        usedReferralCode,
        usedReferralSourceAccountId,
        referredAccounts,
    };
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
    const currentSunflowers = await getSunflowers(accountId);
    if (currentSunflowers < amount) {
        throw new Error('Insufficient sunflowers');
    }

    await createEvent(
        knownEvents.accounts.sunflowersSpentV1(accountId, { amount, reason }),
        db,
    );
}
