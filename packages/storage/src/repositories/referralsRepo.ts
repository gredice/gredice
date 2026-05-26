import 'server-only';
import { randomInt } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { accounts, accountUsers, events, raisedBeds, users } from '../schema';
import { storage } from '../storage';
import { knownEventTypes } from './events';

export const REFERRAL_REWARD_AMOUNT = 10000;

const REFERRAL_EVENT_TYPE = knownEventTypes.accounts.referral;
const REFERRAL_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const REFERRAL_CODE_LENGTH = 10;
const REFERRAL_CODE_GENERATION_ATTEMPTS = 8;

type ReferralDatabase = Pick<
    ReturnType<typeof storage>,
    'execute' | 'insert' | 'select'
>;

type ReferralEventRecord = {
    aggregateId: string;
    data: unknown;
    id: number;
    createdAt: Date;
};

type ReferralSnapshot = {
    currentCodes: Map<string, string>;
    events: ReferralEventRecord[];
    legacyCodes: Map<string, string>;
};

type UsedReferralState = {
    code: string;
    ownerAccountId: string | null;
};

export type ReferralRewardProcessResult =
    | {
          rewarded: true;
          accountId: string;
          ownerAccountId: string;
          amount: number;
      }
    | {
          rewarded: false;
          reason:
              | 'already_rewarded'
              | 'inactive_raised_bed'
              | 'no_referral'
              | 'reciprocal_referral'
              | 'self_referral';
      };

export class ReferralCodeAlreadyExistsError extends Error {}
export class ReferralCodeAlreadyUsedError extends Error {}
export class ReferralCodeInvalidError extends Error {}
export class ReferralCodeNotFoundError extends Error {}
export class ReferralCodeReservedError extends Error {}
export class ReferralCodeReciprocalUseError extends Error {}
export class ReferralCodeSelfUseError extends Error {}

export type ReferralAccountSummary = {
    id: string;
    displayName: string;
    avatarUrl: string | null;
};

export type AccountReferralState = {
    myCode: string | null;
    usedReferralCode: string | null;
    usedReferralOwnerAccountId: string | null;
    usedReferral: {
        code: string;
        account: ReferralAccountSummary | null;
        rewarded: boolean;
    } | null;
    referredAccounts: Array<{
        accountId: string;
        account: ReferralAccountSummary | null;
        rewarded: boolean;
    }>;
};

export function normalizeReferralCode(code: string) {
    return code
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 32);
}

function generateRandomReferralCode() {
    let code = '';
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        code +=
            REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)];
    }
    return code;
}

function referralEventData(data: unknown) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    return data as Record<string, unknown>;
}

function codeFromReferralEventData(
    data: unknown,
    action: 'code_set' | 'used_code' | 'used_code_cleared',
) {
    const record = referralEventData(data);
    if (
        !record ||
        record.action !== action ||
        typeof record.code !== 'string'
    ) {
        return null;
    }
    return normalizeReferralCode(record.code);
}

function codeFromCodeSetEventData(data: unknown) {
    return codeFromReferralEventData(data, 'code_set');
}

function codeFromUsedCodeEventData(data: unknown) {
    return codeFromReferralEventData(data, 'used_code');
}

function isUsedCodeClearedEventData(data: unknown) {
    return referralEventData(data)?.action === 'used_code_cleared';
}

function referredAccountIdFromReferralEventData(data: unknown) {
    const record = referralEventData(data);
    if (
        !record ||
        record.action !== 'referred_account' ||
        typeof record.referredAccountId !== 'string'
    ) {
        return null;
    }
    return record.referredAccountId;
}

function ownerAccountIdFromUsedCodeEventData(data: unknown) {
    const record = referralEventData(data);
    if (
        !record ||
        record.action !== 'used_code' ||
        typeof record.ownerAccountId !== 'string'
    ) {
        return null;
    }
    return record.ownerAccountId;
}

function referralEventRewarded(data: unknown) {
    return referralEventData(data)?.rewarded === true;
}

function isReferralRewardGrantedEventData(data: unknown) {
    return referralEventData(data)?.action === 'reward_granted';
}

function referralCodeOwnerAccountId(
    code: string,
    currentCodes: Map<string, string>,
) {
    for (const [accountId, currentCode] of currentCodes) {
        if (currentCode === code) {
            return accountId;
        }
    }

    return null;
}

async function getReferralSnapshot(
    db: ReferralDatabase,
): Promise<ReferralSnapshot> {
    const [accountRows, eventRows] = await Promise.all([
        db.select({ id: accounts.id }).from(accounts),
        db
            .select({
                aggregateId: events.aggregateId,
                data: events.data,
                createdAt: events.createdAt,
                id: events.id,
            })
            .from(events)
            .where(eq(events.type, REFERRAL_EVENT_TYPE))
            .orderBy(asc(events.createdAt), asc(events.id)),
    ]);

    const currentCodes = new Map<string, string>();
    const legacyCodes = new Map<string, string>();
    for (const account of accountRows) {
        legacyCodes.set(
            account.id,
            normalizeReferralCode(account.id.slice(0, 12)),
        );
    }

    for (const event of eventRows) {
        const eventCode = codeFromCodeSetEventData(event.data);
        if (eventCode) {
            currentCodes.set(event.aggregateId, eventCode);
        }
    }

    return { currentCodes, events: eventRows, legacyCodes };
}

function currentUsedReferralsByAccount(snapshot: ReferralSnapshot) {
    const usedReferrals = new Map<string, UsedReferralState>();

    for (const event of snapshot.events) {
        const usedCode = codeFromUsedCodeEventData(event.data);
        if (usedCode) {
            const ownerAccountId =
                ownerAccountIdFromUsedCodeEventData(event.data) ??
                referralCodeOwnerAccountId(usedCode, snapshot.currentCodes) ??
                referralCodeOwnerAccountId(usedCode, snapshot.legacyCodes);
            usedReferrals.set(event.aggregateId, {
                code: usedCode,
                ownerAccountId,
            });
            continue;
        }

        if (isUsedCodeClearedEventData(event.data)) {
            usedReferrals.delete(event.aggregateId);
        }
    }

    return usedReferrals;
}

function referredRewardsByOwnerAndAccount(snapshot: ReferralSnapshot) {
    const rewards = new Map<string, boolean>();

    for (const event of snapshot.events) {
        const referredAccountId = referredAccountIdFromReferralEventData(
            event.data,
        );
        if (!referredAccountId) {
            continue;
        }
        rewards.set(
            `${event.aggregateId}:${referredAccountId}`,
            referralEventRewarded(event.data),
        );
    }

    return rewards;
}

function referralRewardGrantedForReferredAccount(
    snapshot: ReferralSnapshot,
    accountId: string,
) {
    return snapshot.events.some((event) => {
        if (
            event.aggregateId === accountId &&
            isReferralRewardGrantedEventData(event.data)
        ) {
            return true;
        }

        return (
            referredAccountIdFromReferralEventData(event.data) === accountId &&
            referralEventRewarded(event.data)
        );
    });
}

async function accountHasActiveRaisedBed(
    accountId: string,
    db: ReferralDatabase,
) {
    const [activeRaisedBed] = await db
        .select({ id: raisedBeds.id })
        .from(raisedBeds)
        .where(
            and(
                eq(raisedBeds.accountId, accountId),
                eq(raisedBeds.status, 'active'),
                eq(raisedBeds.isDeleted, false),
            ),
        )
        .limit(1);

    return Boolean(activeRaisedBed);
}

function fallbackReferralAccountSummary(
    accountId: string,
): ReferralAccountSummary {
    return {
        id: accountId,
        displayName: 'Gredice račun',
        avatarUrl: null,
    };
}

async function getReferralAccountSummaries(accountIds: string[]) {
    const uniqueAccountIds = Array.from(new Set(accountIds));
    const summaries = new Map<string, ReferralAccountSummary>();
    for (const accountId of uniqueAccountIds) {
        summaries.set(accountId, fallbackReferralAccountSummary(accountId));
    }

    if (uniqueAccountIds.length === 0) {
        return summaries;
    }

    const primaryAccountUsers = await storage()
        .select({
            accountId: accountUsers.accountId,
            displayName: users.displayName,
            userName: users.userName,
            avatarUrl: users.avatarUrl,
        })
        .from(accountUsers)
        .innerJoin(users, eq(accountUsers.userId, users.id))
        .where(inArray(accountUsers.accountId, uniqueAccountIds))
        .orderBy(asc(accountUsers.createdAt));

    const accountIdsWithUser = new Set<string>();
    for (const accountUser of primaryAccountUsers) {
        if (accountIdsWithUser.has(accountUser.accountId)) {
            continue;
        }
        accountIdsWithUser.add(accountUser.accountId);
        summaries.set(accountUser.accountId, {
            id: accountUser.accountId,
            displayName:
                accountUser.displayName ??
                accountUser.userName ??
                'Gredice račun',
            avatarUrl: accountUser.avatarUrl ?? null,
        });
    }

    return summaries;
}

export async function getReferralAccountSummary(accountId: string | null) {
    if (!accountId) {
        return null;
    }

    const summaries = await getReferralAccountSummaries([accountId]);
    return (
        summaries.get(accountId) ?? fallbackReferralAccountSummary(accountId)
    );
}

export async function getOrCreateDefaultReferralCode(accountId: string) {
    return await storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`referral-default-code:${accountId}`}));`,
        );

        const snapshot = await getReferralSnapshot(tx);
        const existingCode = snapshot.currentCodes.get(accountId);
        if (existingCode) {
            return existingCode;
        }

        for (let i = 0; i < REFERRAL_CODE_GENERATION_ATTEMPTS; i++) {
            const code = generateRandomReferralCode();
            if (
                referralCodeOwnerAccountId(code, snapshot.currentCodes) ||
                referralCodeOwnerAccountId(code, snapshot.legacyCodes)
            ) {
                continue;
            }

            await tx.execute(
                sql`select pg_advisory_xact_lock(hashtext(${`referral-code:${code}`}));`,
            );

            const latestSnapshot = await getReferralSnapshot(tx);
            if (
                referralCodeOwnerAccountId(code, latestSnapshot.currentCodes) ||
                referralCodeOwnerAccountId(code, latestSnapshot.legacyCodes)
            ) {
                continue;
            }

            await tx.insert(events).values({
                type: REFERRAL_EVENT_TYPE,
                version: 1,
                aggregateId: accountId,
                data: { action: 'code_set', code, source: 'generated' },
            });
            return code;
        }

        throw new Error('Failed to generate a unique referral code');
    });
}

export async function getAccountReferralState(
    accountId: string,
    options: { createDefaultCode?: boolean } = {},
): Promise<AccountReferralState> {
    const snapshot = await getReferralSnapshot(storage());
    let myCode = snapshot.currentCodes.get(accountId) ?? null;
    if (!myCode && options.createDefaultCode) {
        myCode = await getOrCreateDefaultReferralCode(accountId);
        snapshot.currentCodes.set(accountId, myCode);
    }

    const usedReferrals = currentUsedReferralsByAccount(snapshot);
    const rewards = referredRewardsByOwnerAndAccount(snapshot);
    const usedReferralState = usedReferrals.get(accountId) ?? null;
    const usedReferralRewarded = referralRewardGrantedForReferredAccount(
        snapshot,
        accountId,
    );
    const referredAccounts: AccountReferralState['referredAccounts'] = [];

    for (const [referredAccountId, referralState] of usedReferrals) {
        if (
            referralState.ownerAccountId !== accountId ||
            referredAccountId === accountId
        ) {
            continue;
        }
        referredAccounts.push({
            accountId: referredAccountId,
            account: null,
            rewarded: rewards.get(`${accountId}:${referredAccountId}`) ?? false,
        });
    }

    const referralAccountSummaries = await getReferralAccountSummaries(
        [
            usedReferralState?.ownerAccountId ?? null,
            ...referredAccounts.map(
                (referredAccount) => referredAccount.accountId,
            ),
        ].filter((id): id is string => id !== null),
    );
    const usedReferralAccount = usedReferralState?.ownerAccountId
        ? (referralAccountSummaries.get(usedReferralState.ownerAccountId) ??
          null)
        : null;
    const referredAccountsWithSummaries = referredAccounts.map(
        (referredAccount) => ({
            ...referredAccount,
            account:
                referralAccountSummaries.get(referredAccount.accountId) ?? null,
        }),
    );

    return {
        myCode,
        usedReferralCode: usedReferralState?.code ?? null,
        usedReferralOwnerAccountId: usedReferralState?.ownerAccountId ?? null,
        usedReferral: usedReferralState
            ? {
                  code: usedReferralState.code,
                  account: usedReferralAccount,
                  rewarded: usedReferralRewarded,
              }
            : null,
        referredAccounts: referredAccountsWithSummaries,
    };
}

async function processReferralRewardsForAccountInTransaction(
    accountId: string,
    tx: ReferralDatabase,
    options: {
        usedReferral?: UsedReferralState;
    } = {},
): Promise<ReferralRewardProcessResult> {
    await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`referral-reward:${accountId}`}));`,
    );

    const snapshot = await getReferralSnapshot(tx);
    if (referralRewardGrantedForReferredAccount(snapshot, accountId)) {
        return { rewarded: false, reason: 'already_rewarded' };
    }

    const usedReferrals = currentUsedReferralsByAccount(snapshot);
    const usedReferral = options.usedReferral ?? usedReferrals.get(accountId);
    if (!usedReferral?.ownerAccountId) {
        return { rewarded: false, reason: 'no_referral' };
    }
    if (usedReferral.ownerAccountId === accountId) {
        return { rewarded: false, reason: 'self_referral' };
    }
    if (
        usedReferrals.get(usedReferral.ownerAccountId)?.ownerAccountId ===
        accountId
    ) {
        return { rewarded: false, reason: 'reciprocal_referral' };
    }

    if (!(await accountHasActiveRaisedBed(accountId, tx))) {
        return { rewarded: false, reason: 'inactive_raised_bed' };
    }

    const rewardedAt = new Date().toISOString();
    await tx.insert(events).values([
        {
            type: knownEventTypes.accounts.earnSunflowers,
            version: 1,
            aggregateId: accountId,
            data: {
                amount: REFERRAL_REWARD_AMOUNT,
                reason: `referral:used:${usedReferral.ownerAccountId}`,
            },
        },
        {
            type: knownEventTypes.accounts.earnSunflowers,
            version: 1,
            aggregateId: usedReferral.ownerAccountId,
            data: {
                amount: REFERRAL_REWARD_AMOUNT,
                reason: `referral:referred:${accountId}`,
            },
        },
        {
            type: REFERRAL_EVENT_TYPE,
            version: 1,
            aggregateId: usedReferral.ownerAccountId,
            data: {
                action: 'referred_account',
                referredAccountId: accountId,
                code: usedReferral.code,
                rewarded: true,
                rewardedAt,
            },
        },
        {
            type: REFERRAL_EVENT_TYPE,
            version: 1,
            aggregateId: accountId,
            data: {
                action: 'reward_granted',
                code: usedReferral.code,
                ownerAccountId: usedReferral.ownerAccountId,
                amount: REFERRAL_REWARD_AMOUNT,
                rewardedAt,
            },
        },
    ]);

    return {
        rewarded: true,
        accountId,
        ownerAccountId: usedReferral.ownerAccountId,
        amount: REFERRAL_REWARD_AMOUNT,
    };
}

export async function processReferralRewardsForAccount(accountId: string) {
    return await storage().transaction((tx) =>
        processReferralRewardsForAccountInTransaction(accountId, tx),
    );
}

export async function setReferralCodeForAccount(
    accountId: string,
    inputCode: string,
    options: { source?: 'admin' | 'user' } = {},
) {
    const code = normalizeReferralCode(inputCode);
    if (!code) {
        throw new ReferralCodeInvalidError();
    }

    return await storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`referral-code:${code}`}));`,
        );

        const snapshot = await getReferralSnapshot(tx);
        if (referralCodeOwnerAccountId(code, snapshot.legacyCodes)) {
            throw new ReferralCodeReservedError();
        }

        const ownerAccountId = referralCodeOwnerAccountId(
            code,
            snapshot.currentCodes,
        );
        if (ownerAccountId && ownerAccountId !== accountId) {
            throw new ReferralCodeAlreadyExistsError();
        }

        await tx.insert(events).values({
            type: REFERRAL_EVENT_TYPE,
            version: 1,
            aggregateId: accountId,
            data: {
                action: 'code_set',
                code,
                source: options.source ?? 'user',
            },
        });

        return code;
    });
}

export async function redeemReferralCodeForAccount(
    accountId: string,
    inputCode: string,
) {
    const code = normalizeReferralCode(inputCode);
    if (!code) {
        throw new ReferralCodeInvalidError();
    }

    let ownerAccountId: string | null = null;
    let rewardResult: ReferralRewardProcessResult = {
        rewarded: false,
        reason: 'inactive_raised_bed',
    };

    await storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`referral-use:${accountId}`}));`,
        );
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`referral-code:${code}`}));`,
        );

        const snapshot = await getReferralSnapshot(tx);
        const usedReferrals = currentUsedReferralsByAccount(snapshot);
        const existingUsedReferral = usedReferrals.get(accountId);
        if (referralRewardGrantedForReferredAccount(snapshot, accountId)) {
            throw new ReferralCodeAlreadyUsedError();
        }

        ownerAccountId = referralCodeOwnerAccountId(
            code,
            snapshot.currentCodes,
        );
        if (!ownerAccountId) {
            throw new ReferralCodeNotFoundError();
        }

        if (ownerAccountId === accountId) {
            throw new ReferralCodeSelfUseError();
        }
        if (usedReferrals.get(ownerAccountId)?.ownerAccountId === accountId) {
            throw new ReferralCodeReciprocalUseError();
        }

        const usedReferralChanged =
            !existingUsedReferral ||
            existingUsedReferral.code !== code ||
            existingUsedReferral.ownerAccountId !== ownerAccountId;

        if (usedReferralChanged) {
            await tx.insert(events).values([
                {
                    type: REFERRAL_EVENT_TYPE,
                    version: 1,
                    aggregateId: accountId,
                    data: {
                        action: 'used_code',
                        code,
                        ownerAccountId,
                        previousCode: existingUsedReferral?.code,
                        previousOwnerAccountId:
                            existingUsedReferral?.ownerAccountId,
                    },
                },
                {
                    type: REFERRAL_EVENT_TYPE,
                    version: 1,
                    aggregateId: ownerAccountId,
                    data: {
                        action: 'referred_account',
                        referredAccountId: accountId,
                        code,
                        rewarded: false,
                    },
                },
            ]);
        }

        rewardResult = await processReferralRewardsForAccountInTransaction(
            accountId,
            tx,
            {
                usedReferral: {
                    code,
                    ownerAccountId,
                },
            },
        );
        if (
            !rewardResult.rewarded &&
            rewardResult.reason === 'already_rewarded'
        ) {
            throw new ReferralCodeAlreadyUsedError();
        }
    });

    if (!ownerAccountId) {
        throw new ReferralCodeNotFoundError();
    }

    return { code, ownerAccountId, reward: rewardResult };
}

export async function clearUsedReferralCodeForAccount(
    accountId: string,
    options: { source?: 'admin' } = {},
) {
    return await storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`referral-use:${accountId}`}));`,
        );

        const snapshot = await getReferralSnapshot(tx);
        const usedReferral =
            currentUsedReferralsByAccount(snapshot).get(accountId);
        if (!usedReferral) {
            return null;
        }

        await tx.insert(events).values({
            type: REFERRAL_EVENT_TYPE,
            version: 1,
            aggregateId: accountId,
            data: {
                action: 'used_code_cleared',
                code: usedReferral.code,
                ownerAccountId: usedReferral.ownerAccountId,
                source: options.source ?? 'admin',
            },
        });

        return usedReferral;
    });
}
