import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
    accounts,
    aiAccountLimitOverrides,
    aiChatConversations,
    aiChatMessages,
    aiChatToolCalls,
    aiUsageLedger,
} from '../schema';
import { storage } from '../storage';
import { accountHasActiveRaisedBed } from './gardensRepo';

export const SUNCOKRET_AI_FEATURE = 'suncokret-chat';
export const SUNCOKRET_ACTIVE_DAILY_LIMIT_MICRO_USD = 1_000_000;
export const SUNCOKRET_TRIAL_DAILY_LIMIT_MICRO_USD = 100_000;
export const SUNCOKRET_TRIAL_CHAT_DAYS = 5;
export const SUNCOKRET_FALLBACK_TIME_ZONE = 'Europe/Zagreb';

export type AiChatPricing = {
    inputUsdPerMillionTokens: number;
    outputUsdPerMillionTokens: number;
};

export type AiChatUsageCost = {
    inputMicroUsd: number;
    outputMicroUsd: number;
    totalMicroUsd: number;
};

export type AiChatLimitTier = 'active-raised-bed' | 'trial-no-active-bed';

export type AiChatLimitState = {
    accountId: string;
    activeRaisedBed: boolean;
    tier: AiChatLimitTier;
    timeZone: string;
    usageDate: string;
    retryAt: string;
    dailyLimitMicroUsd: number;
    usedMicroUsd: number;
    reservedMicroUsd: number;
    remainingMicroUsd: number;
    trialChatDaysUsed: number;
    trialChatDaysLimit: number;
    disabled: boolean;
    blockedReason: 'disabled' | 'trial_days_exhausted' | null;
};

export type AiChatMessageForStorage = {
    id: string;
    role: string;
    parts: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
};

type DatabaseClient = ReturnType<typeof storage>;

function validTimeZone(timeZone: string | null | undefined) {
    const fallback = SUNCOKRET_FALLBACK_TIME_ZONE;
    const candidate = timeZone?.trim() || fallback;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format();
        return candidate;
    } catch {
        return fallback;
    }
}

function localDateParts(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
    );

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
    };
}

export function aiChatUsageDateKey(date = new Date(), timeZone?: string) {
    const zone = validTimeZone(timeZone);
    const { day, month, year } = localDateParts(date, zone);
    return `${year.toString().padStart(4, '0')}-${month
        .toString()
        .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function zonedLocalMidnightToUtc(dateKey: string, timeZone: string) {
    const [yearRaw, monthRaw, dayRaw] = dateKey.split('-').map(Number);
    const year = yearRaw ?? 1970;
    const month = monthRaw ?? 1;
    const day = dayRaw ?? 1;
    const targetUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    let utc = targetUtc;

    for (let i = 0; i < 4; i++) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(new Date(utc));
        const values = Object.fromEntries(
            parts.map((part) => [part.type, part.value]),
        );
        const renderedUtc = Date.UTC(
            Number(values.year),
            Number(values.month) - 1,
            Number(values.day),
            Number(values.hour),
            Number(values.minute),
            Number(values.second),
        );
        const diff = targetUtc - renderedUtc;
        if (diff === 0) {
            break;
        }
        utc += diff;
    }

    return new Date(utc);
}

export function aiChatRetryAtIso(usageDate: string, timeZone: string) {
    return zonedLocalMidnightToUtc(
        addDaysToDateKey(usageDate, 1),
        validTimeZone(timeZone),
    ).toISOString();
}

function finiteNonNegativeInteger(value: number) {
    return Number.isFinite(value) ? Math.max(0, Math.ceil(value)) : 0;
}

export function calculateAiChatUsageCostMicroUsd({
    inputTokens,
    outputTokens,
    pricing,
}: {
    inputTokens: number;
    outputTokens: number;
    pricing: AiChatPricing;
}): AiChatUsageCost {
    const normalizedInputTokens = finiteNonNegativeInteger(inputTokens);
    const normalizedOutputTokens = finiteNonNegativeInteger(outputTokens);
    const inputMicroUsd = finiteNonNegativeInteger(
        normalizedInputTokens * pricing.inputUsdPerMillionTokens,
    );
    const outputMicroUsd = finiteNonNegativeInteger(
        normalizedOutputTokens * pricing.outputUsdPerMillionTokens,
    );

    return {
        inputMicroUsd,
        outputMicroUsd,
        totalMicroUsd: inputMicroUsd + outputMicroUsd,
    };
}

function statusCountsAsReserved(status: string) {
    return status === 'reserved';
}

function statusCountsAsFinalized(status: string) {
    return status === 'finalized';
}

function metadataObject(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

function messageParts(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value)
        ? value.filter(
              (item): item is Record<string, unknown> =>
                  Boolean(item) &&
                  typeof item === 'object' &&
                  !Array.isArray(item),
          )
        : [];
}

function messageRole(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
        ? value
        : 'user';
}

export function normalizeAiChatMessagesForStorage(
    messages: unknown[],
): AiChatMessageForStorage[] {
    const normalized: AiChatMessageForStorage[] = [];

    for (const message of messages) {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            continue;
        }

        const record = message as Record<string, unknown>;
        const id =
            typeof record.id === 'string' && record.id.trim().length > 0
                ? record.id
                : randomUUID();
        normalized.push({
            id,
            role: messageRole(record.role),
            parts: messageParts(record.parts),
            metadata: metadataObject(record.metadata),
        });
    }

    return normalized;
}

function toolCallValue(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

function extractToolCallRows(
    conversationId: string,
    messages: AiChatMessageForStorage[],
) {
    const rows: Array<typeof aiChatToolCalls.$inferInsert> = [];

    for (const message of messages) {
        for (const part of message.parts) {
            const type = typeof part.type === 'string' ? part.type : '';
            if (!type.startsWith('tool-')) {
                continue;
            }

            const approval = toolCallValue(part.approval);
            rows.push({
                id: randomUUID(),
                conversationId,
                messageId: message.id,
                toolCallId:
                    typeof part.toolCallId === 'string'
                        ? part.toolCallId
                        : typeof part.id === 'string'
                          ? part.id
                          : null,
                toolName: type.slice('tool-'.length),
                state:
                    typeof part.state === 'string'
                        ? part.state
                        : typeof approval?.state === 'string'
                          ? approval.state
                          : 'unknown',
                input: toolCallValue(part.input) ?? toolCallValue(part.args),
                output:
                    toolCallValue(part.output) ?? toolCallValue(part.result),
                error:
                    typeof part.errorText === 'string' ? part.errorText : null,
                needsApproval: Boolean(approval),
                approvedAt:
                    approval?.state === 'approved' ? new Date() : undefined,
            });
        }
    }

    return rows;
}

export async function getAiChatAccountLimitState(
    accountId: string,
    now = new Date(),
    db: DatabaseClient = storage(),
): Promise<AiChatLimitState> {
    const account = await db.query.accounts.findFirst({
        columns: { id: true, timeZone: true },
        where: eq(accounts.id, accountId),
    });
    const activeRaisedBed = await accountHasActiveRaisedBed(accountId, db);
    const override = await db.query.aiAccountLimitOverrides.findFirst({
        where: eq(aiAccountLimitOverrides.accountId, accountId),
    });
    const ledgerRows = await db.query.aiUsageLedger.findMany({
        columns: {
            usageDate: true,
            status: true,
            reservedMicroUsd: true,
            totalMicroUsd: true,
        },
        where: and(
            eq(aiUsageLedger.accountId, accountId),
            eq(aiUsageLedger.feature, SUNCOKRET_AI_FEATURE),
        ),
    });

    const timeZone = validTimeZone(account?.timeZone);
    const usageDate = aiChatUsageDateKey(now, timeZone);
    const todayRows = ledgerRows.filter((row) => row.usageDate === usageDate);
    const usedMicroUsd = todayRows.reduce(
        (sum, row) =>
            statusCountsAsFinalized(row.status) ? sum + row.totalMicroUsd : sum,
        0,
    );
    const reservedMicroUsd = todayRows.reduce(
        (sum, row) =>
            statusCountsAsReserved(row.status)
                ? sum + row.reservedMicroUsd
                : sum,
        0,
    );
    const finalizedUsageDates = new Set(
        ledgerRows
            .filter((row) => statusCountsAsFinalized(row.status))
            .map((row) => row.usageDate),
    );
    const trialChatDaysUsed = finalizedUsageDates.size;
    const priorTrialChatDaysUsed = Array.from(finalizedUsageDates).filter(
        (dateKey) => dateKey < usageDate,
    ).length;
    const trialChatDaysLimit =
        override?.trialChatDays ?? SUNCOKRET_TRIAL_CHAT_DAYS;
    const tier: AiChatLimitTier = activeRaisedBed
        ? 'active-raised-bed'
        : 'trial-no-active-bed';
    const defaultDailyLimit = activeRaisedBed
        ? SUNCOKRET_ACTIVE_DAILY_LIMIT_MICRO_USD
        : SUNCOKRET_TRIAL_DAILY_LIMIT_MICRO_USD;
    const dailyLimitMicroUsd =
        (activeRaisedBed
            ? override?.activeDailyLimitMicroUsd
            : override?.trialDailyLimitMicroUsd) ?? defaultDailyLimit;
    const spentOrReservedMicroUsd = usedMicroUsd + reservedMicroUsd;
    const disabled = Boolean(override?.disabled);
    const blockedReason = disabled
        ? 'disabled'
        : !activeRaisedBed && priorTrialChatDaysUsed >= trialChatDaysLimit
          ? 'trial_days_exhausted'
          : null;

    return {
        accountId,
        activeRaisedBed,
        tier,
        timeZone,
        usageDate,
        retryAt: aiChatRetryAtIso(usageDate, timeZone),
        dailyLimitMicroUsd,
        usedMicroUsd,
        reservedMicroUsd,
        remainingMicroUsd: Math.max(
            0,
            dailyLimitMicroUsd - spentOrReservedMicroUsd,
        ),
        trialChatDaysUsed,
        trialChatDaysLimit,
        disabled,
        blockedReason,
    };
}

export async function reserveAiChatUsage({
    accountId,
    conversationId,
    estimatedCostMicroUsd,
    model,
    requestId,
    userId,
}: {
    accountId: string;
    conversationId: string;
    estimatedCostMicroUsd: number;
    model: string;
    requestId: string;
    userId: string;
}) {
    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`ai-chat-usage:${accountId}`}));`,
        );

        const limitState = await getAiChatAccountLimitState(
            accountId,
            new Date(),
            tx as DatabaseClient,
        );
        if (
            limitState.blockedReason ||
            limitState.remainingMicroUsd < estimatedCostMicroUsd
        ) {
            return {
                ok: false as const,
                limitState,
            };
        }

        const id = randomUUID();
        await tx.insert(aiUsageLedger).values({
            id,
            accountId,
            userId,
            conversationId,
            requestId,
            feature: SUNCOKRET_AI_FEATURE,
            model,
            provider: model.split('/')[0] ?? null,
            usageDate: limitState.usageDate,
            status: 'reserved',
            reservedMicroUsd: estimatedCostMicroUsd,
        });

        return {
            ok: true as const,
            ledgerId: id,
            limitState,
        };
    });
}

export async function finalizeAiChatUsage({
    inputTokens,
    ledgerId,
    outputTokens,
    pricing,
    totalTokens,
}: {
    inputTokens: number;
    ledgerId: string;
    outputTokens: number;
    pricing: AiChatPricing;
    totalTokens?: number;
}) {
    const cost = calculateAiChatUsageCostMicroUsd({
        inputTokens,
        outputTokens,
        pricing,
    });

    await storage()
        .update(aiUsageLedger)
        .set({
            status: 'finalized',
            inputTokens: finiteNonNegativeInteger(inputTokens),
            outputTokens: finiteNonNegativeInteger(outputTokens),
            totalTokens: finiteNonNegativeInteger(
                totalTokens ?? inputTokens + outputTokens,
            ),
            inputMicroUsd: cost.inputMicroUsd,
            outputMicroUsd: cost.outputMicroUsd,
            totalMicroUsd: cost.totalMicroUsd,
            finalizedAt: new Date(),
        })
        .where(eq(aiUsageLedger.id, ledgerId));

    return cost;
}

export async function releaseAiChatUsageReservation({
    error,
    ledgerId,
    status = 'released',
}: {
    error?: string;
    ledgerId: string;
    status?: 'released' | 'failed';
}) {
    await storage()
        .update(aiUsageLedger)
        .set({
            status,
            error,
            reservedMicroUsd: 0,
            finalizedAt: new Date(),
        })
        .where(eq(aiUsageLedger.id, ledgerId));
}

export async function ensureAiChatConversation({
    accountId,
    gardenId,
    id,
    model,
    raisedBedId,
    title,
    userId,
}: {
    accountId: string;
    gardenId?: number | null;
    id: string;
    model?: string | null;
    raisedBedId?: number | null;
    title?: string | null;
    userId: string;
}) {
    const existing = await storage().query.aiChatConversations.findFirst({
        where: eq(aiChatConversations.id, id),
    });

    if (existing) {
        if (existing.accountId !== accountId) {
            return null;
        }

        await storage()
            .update(aiChatConversations)
            .set({
                gardenId: gardenId ?? existing.gardenId,
                raisedBedId: raisedBedId ?? existing.raisedBedId,
                model: model ?? existing.model,
                lastMessageAt: new Date(),
            })
            .where(eq(aiChatConversations.id, id));
        return existing;
    }

    const [created] = await storage()
        .insert(aiChatConversations)
        .values({
            id,
            accountId,
            userId,
            gardenId,
            raisedBedId,
            title,
            model,
            lastMessageAt: new Date(),
        })
        .returning();

    return created ?? null;
}

export async function replaceAiChatMessages({
    conversationId,
    messages,
}: {
    conversationId: string;
    messages: unknown[];
}) {
    const normalizedMessages = normalizeAiChatMessagesForStorage(messages);

    await storage().transaction(async (tx) => {
        await tx
            .delete(aiChatToolCalls)
            .where(eq(aiChatToolCalls.conversationId, conversationId));
        await tx
            .delete(aiChatMessages)
            .where(eq(aiChatMessages.conversationId, conversationId));

        if (normalizedMessages.length > 0) {
            await tx.insert(aiChatMessages).values(
                normalizedMessages.map((message) => ({
                    id: message.id,
                    conversationId,
                    role: message.role,
                    parts: message.parts,
                    metadata: message.metadata,
                })),
            );
        }

        const toolCalls = extractToolCallRows(
            conversationId,
            normalizedMessages,
        );
        if (toolCalls.length > 0) {
            await tx.insert(aiChatToolCalls).values(toolCalls);
        }

        await tx
            .update(aiChatConversations)
            .set({ lastMessageAt: new Date() })
            .where(eq(aiChatConversations.id, conversationId));
    });
}

export async function getAiChatConversationsForAdmin(limit = 100) {
    return storage().query.aiChatConversations.findMany({
        orderBy: desc(aiChatConversations.lastMessageAt),
        limit,
        with: {
            messages: {
                orderBy: aiChatMessages.createdAt,
            },
            toolCalls: {
                orderBy: aiChatToolCalls.createdAt,
            },
            usageLedger: true,
            user: true,
        },
    });
}

export async function getAiChatUsageTotals(filter?: { from?: Date }) {
    const rows = await storage().query.aiUsageLedger.findMany({
        where: and(
            eq(aiUsageLedger.feature, SUNCOKRET_AI_FEATURE),
            filter?.from
                ? gte(aiUsageLedger.createdAt, filter.from)
                : undefined,
        ),
    });

    return rows.reduce(
        (totals, row) => {
            if (row.status !== 'finalized') {
                if (row.status === 'reserved') {
                    totals.reservedMicroUsd += row.reservedMicroUsd;
                }
                return totals;
            }

            totals.count += 1;
            totals.inputTokens += row.inputTokens;
            totals.outputTokens += row.outputTokens;
            totals.totalTokens += row.totalTokens;
            totals.totalMicroUsd += row.totalMicroUsd;
            return totals;
        },
        {
            count: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            totalMicroUsd: 0,
            reservedMicroUsd: 0,
        },
    );
}

export async function getAiChatAccountLimitSummaries(limit = 100) {
    const accountRows = await storage().query.accounts.findMany({
        orderBy: desc(accounts.createdAt),
        limit,
        with: {
            accountUsers: {
                with: {
                    user: true,
                },
            },
        },
    });

    return Promise.all(
        accountRows.map(async (account) => ({
            account,
            limitState: await getAiChatAccountLimitState(account.id),
        })),
    );
}

export async function setAiAccountLimitOverride({
    accountId,
    activeDailyLimitMicroUsd,
    disabled,
    notes,
    trialChatDays,
    trialDailyLimitMicroUsd,
    updatedByUserId,
}: {
    accountId: string;
    activeDailyLimitMicroUsd?: number | null;
    disabled?: boolean;
    notes?: string | null;
    trialChatDays?: number | null;
    trialDailyLimitMicroUsd?: number | null;
    updatedByUserId?: string | null;
}) {
    const values = {
        accountId,
        activeDailyLimitMicroUsd,
        disabled,
        notes,
        trialChatDays,
        trialDailyLimitMicroUsd,
        updatedByUserId,
    };

    await storage()
        .insert(aiAccountLimitOverrides)
        .values(values)
        .onConflictDoUpdate({
            target: aiAccountLimitOverrides.accountId,
            set: {
                activeDailyLimitMicroUsd,
                disabled,
                notes,
                trialChatDays,
                trialDailyLimitMicroUsd,
                updatedByUserId,
                updatedAt: sql`now()`,
            },
        });
}
