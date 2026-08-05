import 'server-only';
import { randomUUID } from 'node:crypto';
import { sanitizeSuncokretAssistantText } from '@gredice/js/ai';
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
export const SUNCOKRET_ACTIVE_DAILY_LIMIT_MICRO_EUR = 800_000;
export const SUNCOKRET_ACTIVE_WEEKLY_LIMIT_MICRO_EUR = 3_000_000;
export const SUNCOKRET_TRIAL_DAILY_LIMIT_MICRO_EUR = 300_000;
export const SUNCOKRET_TRIAL_WEEKLY_LIMIT_MICRO_EUR = 800_000;
export const SUNCOKRET_TRIAL_CHAT_DAYS = 3;
export const SUNCOKRET_FALLBACK_TIME_ZONE = 'Europe/Zagreb';
export const SUNCOKRET_DAILY_WINDOW_MS = 24 * 60 * 60 * 1_000;

export type AiChatPricing = {
    inputEurPerMillionTokens: number;
    outputEurPerMillionTokens: number;
    cachedInputEurPerMillionTokens?: number;
    cacheWriteInputEurPerMillionTokens?: number;
};

export type AiChatUsageCost = {
    inputMicroEur: number;
    outputMicroEur: number;
    totalMicroEur: number;
};

export type AiChatLimitTier = 'active-raised-bed' | 'trial-no-active-bed';

export type AiChatLimitState = {
    accountId: string;
    activeRaisedBed: boolean;
    tier: AiChatLimitTier;
    timeZone: string;
    usageDate: string;
    retryAt: string;
    dailyWindowStartedAt: string;
    dailyRetryAt: string;
    dailyLimitMicroEur: number;
    usedMicroEur: number;
    reservedMicroEur: number;
    remainingMicroEur: number;
    weekStartUsageDate: string;
    weeklyRetryAt: string;
    weeklyLimitMicroEur: number;
    weeklyUsedMicroEur: number;
    weeklyReservedMicroEur: number;
    weeklyRemainingMicroEur: number;
    spendableMicroEur: number;
    usedInputTokens: number;
    usedOutputTokens: number;
    usedTotalTokens: number;
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

function startOfIsoWeekDateKey(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    return addDaysToDateKey(dateKey, -daysSinceMonday);
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

function isoWeekRetryAtIso(weekStartUsageDate: string, timeZone: string) {
    return zonedLocalMidnightToUtc(
        addDaysToDateKey(weekStartUsageDate, 7),
        validTimeZone(timeZone),
    ).toISOString();
}

function rollingWindowRetryAtIso(
    rows: Array<{ createdAt: Date; status: string }>,
    now: Date,
) {
    const firstCountedAt = rows
        .filter(
            (row) =>
                statusCountsAsFinalized(row.status) ||
                statusCountsAsReserved(row.status),
        )
        .reduce<Date | null>(
            (first, row) =>
                !first || row.createdAt < first ? row.createdAt : first,
            null,
        );

    return new Date(
        (firstCountedAt?.getTime() ?? now.getTime()) +
            SUNCOKRET_DAILY_WINDOW_MS,
    ).toISOString();
}

function finiteNonNegativeInteger(value: number) {
    return Number.isFinite(value) ? Math.max(0, Math.ceil(value)) : 0;
}

export function calculateAiChatUsageCostMicroEur({
    cacheReadTokens,
    cacheWriteTokens,
    inputTokens,
    noCacheTokens,
    outputTokens,
    pricing,
}: {
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    inputTokens: number;
    noCacheTokens?: number;
    outputTokens: number;
    pricing: AiChatPricing;
}): AiChatUsageCost {
    const normalizedInputTokens = finiteNonNegativeInteger(inputTokens);
    const normalizedOutputTokens = finiteNonNegativeInteger(outputTokens);
    const normalizedCacheReadTokens = finiteNonNegativeInteger(
        cacheReadTokens ?? 0,
    );
    const normalizedCacheWriteTokens = finiteNonNegativeInteger(
        cacheWriteTokens ?? 0,
    );
    const normalizedNoCacheTokens =
        noCacheTokens == null
            ? Math.max(
                  0,
                  normalizedInputTokens -
                      normalizedCacheReadTokens -
                      normalizedCacheWriteTokens,
              )
            : finiteNonNegativeInteger(noCacheTokens);
    const inputMicroEur = finiteNonNegativeInteger(
        normalizedNoCacheTokens * pricing.inputEurPerMillionTokens +
            normalizedCacheReadTokens *
                (pricing.cachedInputEurPerMillionTokens ??
                    pricing.inputEurPerMillionTokens) +
            normalizedCacheWriteTokens *
                (pricing.cacheWriteInputEurPerMillionTokens ??
                    pricing.inputEurPerMillionTokens),
    );
    const outputMicroEur = finiteNonNegativeInteger(
        normalizedOutputTokens * pricing.outputEurPerMillionTokens,
    );

    return {
        inputMicroEur,
        outputMicroEur,
        totalMicroEur: inputMicroEur + outputMicroEur,
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

function sanitizedMessageParts(value: unknown, role: string) {
    const parts = messageParts(value);
    if (role !== 'assistant') {
        return parts;
    }

    return parts.map((part) =>
        part.type === 'text' && typeof part.text === 'string'
            ? {
                  ...part,
                  text: sanitizeSuncokretAssistantText(part.text),
              }
            : part,
    );
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
        const role = messageRole(record.role);
        normalized.push({
            id,
            role,
            parts: sanitizedMessageParts(record.parts, role),
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
    approvedByUserId?: string,
    existingToolCallsById: ReadonlyMap<
        string,
        typeof aiChatToolCalls.$inferSelect
    > = new Map(),
) {
    const rows: Array<typeof aiChatToolCalls.$inferInsert> = [];

    for (const message of messages) {
        for (const part of message.parts) {
            const type = typeof part.type === 'string' ? part.type : '';
            if (!type.startsWith('tool-')) {
                continue;
            }

            const approval = toolCallValue(part.approval);
            const approved =
                approval?.approved === true || approval?.state === 'approved';
            const errorText =
                typeof part.errorText === 'string' ? part.errorText : null;
            const mcpErrorCategory =
                typeof part.mcpErrorCategory === 'string'
                    ? part.mcpErrorCategory
                    : null;
            const toolCallId =
                typeof part.toolCallId === 'string'
                    ? part.toolCallId
                    : typeof part.id === 'string'
                      ? part.id
                      : null;
            const existingToolCall = toolCallId
                ? existingToolCallsById.get(toolCallId)
                : undefined;
            rows.push({
                id: existingToolCall?.id ?? randomUUID(),
                conversationId,
                messageId: message.id,
                toolCallId,
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
                error: mcpErrorCategory
                    ? `[${mcpErrorCategory}]${errorText ? ` ${errorText}` : ''}`
                    : (existingToolCall?.error ?? errorText),
                needsApproval:
                    Boolean(approval) ||
                    (existingToolCall?.needsApproval ?? false),
                approvedByUserId: approved
                    ? (existingToolCall?.approvedByUserId ?? approvedByUserId)
                    : existingToolCall?.approvedByUserId,
                approvedAt: approved
                    ? (existingToolCall?.approvedAt ?? new Date())
                    : existingToolCall?.approvedAt,
                durationMs: existingToolCall?.durationMs,
                mcpCorrelationId:
                    typeof part.mcpCorrelationId === 'string'
                        ? part.mcpCorrelationId
                        : (existingToolCall?.mcpCorrelationId ?? null),
                createdAt: existingToolCall?.createdAt,
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
            createdAt: true,
            usageDate: true,
            status: true,
            inputTokens: true,
            outputTokens: true,
            reservedMicroEur: true,
            totalTokens: true,
            totalMicroEur: true,
        },
        where: and(
            eq(aiUsageLedger.accountId, accountId),
            eq(aiUsageLedger.feature, SUNCOKRET_AI_FEATURE),
        ),
    });

    const timeZone = validTimeZone(account?.timeZone);
    const usageDate = aiChatUsageDateKey(now, timeZone);
    const dailyWindowStartedAt = new Date(
        now.getTime() - SUNCOKRET_DAILY_WINDOW_MS,
    );
    const dailyRows = ledgerRows.filter(
        (row) => row.createdAt >= dailyWindowStartedAt && row.createdAt <= now,
    );
    const weekStartUsageDate = startOfIsoWeekDateKey(usageDate);
    const weekRows = ledgerRows.filter(
        (row) =>
            row.usageDate >= weekStartUsageDate && row.usageDate <= usageDate,
    );
    const usedMicroEur = dailyRows.reduce(
        (sum, row) =>
            statusCountsAsFinalized(row.status) ? sum + row.totalMicroEur : sum,
        0,
    );
    const reservedMicroEur = dailyRows.reduce(
        (sum, row) =>
            statusCountsAsReserved(row.status)
                ? sum + row.reservedMicroEur
                : sum,
        0,
    );
    const weeklyUsedMicroEur = weekRows.reduce(
        (sum, row) =>
            statusCountsAsFinalized(row.status) ? sum + row.totalMicroEur : sum,
        0,
    );
    const weeklyReservedMicroEur = weekRows.reduce(
        (sum, row) =>
            statusCountsAsReserved(row.status)
                ? sum + row.reservedMicroEur
                : sum,
        0,
    );
    const usedInputTokens = dailyRows.reduce(
        (sum, row) =>
            statusCountsAsFinalized(row.status) ? sum + row.inputTokens : sum,
        0,
    );
    const usedOutputTokens = dailyRows.reduce(
        (sum, row) =>
            statusCountsAsFinalized(row.status) ? sum + row.outputTokens : sum,
        0,
    );
    const usedTotalTokens = dailyRows.reduce(
        (sum, row) =>
            statusCountsAsFinalized(row.status) ? sum + row.totalTokens : sum,
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
        ? SUNCOKRET_ACTIVE_DAILY_LIMIT_MICRO_EUR
        : SUNCOKRET_TRIAL_DAILY_LIMIT_MICRO_EUR;
    const defaultWeeklyLimit = activeRaisedBed
        ? SUNCOKRET_ACTIVE_WEEKLY_LIMIT_MICRO_EUR
        : SUNCOKRET_TRIAL_WEEKLY_LIMIT_MICRO_EUR;
    const dailyLimitMicroEur =
        (activeRaisedBed
            ? override?.activeDailyLimitMicroEur
            : override?.trialDailyLimitMicroEur) ?? defaultDailyLimit;
    const weeklyLimitMicroEur =
        (activeRaisedBed
            ? override?.activeWeeklyLimitMicroEur
            : override?.trialWeeklyLimitMicroEur) ?? defaultWeeklyLimit;
    const spentOrReservedMicroEur = usedMicroEur + reservedMicroEur;
    const weeklySpentOrReservedMicroEur =
        weeklyUsedMicroEur + weeklyReservedMicroEur;
    const disabled = Boolean(override?.disabled);
    const blockedReason = disabled
        ? 'disabled'
        : !activeRaisedBed && priorTrialChatDaysUsed >= trialChatDaysLimit
          ? 'trial_days_exhausted'
          : null;
    const remainingMicroEur = Math.max(
        0,
        dailyLimitMicroEur - spentOrReservedMicroEur,
    );
    const weeklyRemainingMicroEur = Math.max(
        0,
        weeklyLimitMicroEur - weeklySpentOrReservedMicroEur,
    );
    const spendableMicroEur = Math.min(
        remainingMicroEur,
        weeklyRemainingMicroEur,
    );
    const dailyRetryAt = rollingWindowRetryAtIso(dailyRows, now);
    const weeklyRetryAt = isoWeekRetryAtIso(weekStartUsageDate, timeZone);
    const dailyExhausted = remainingMicroEur <= 0;
    const weeklyExhausted = weeklyRemainingMicroEur <= 0;
    const retryAt =
        dailyExhausted && weeklyExhausted
            ? new Date(
                  Math.max(
                      new Date(dailyRetryAt).getTime(),
                      new Date(weeklyRetryAt).getTime(),
                  ),
              ).toISOString()
            : weeklyExhausted || weeklyRemainingMicroEur < remainingMicroEur
              ? weeklyRetryAt
              : dailyRetryAt;

    return {
        accountId,
        activeRaisedBed,
        tier,
        timeZone,
        usageDate,
        retryAt,
        dailyWindowStartedAt: dailyWindowStartedAt.toISOString(),
        dailyRetryAt,
        dailyLimitMicroEur,
        usedMicroEur,
        reservedMicroEur,
        remainingMicroEur,
        weekStartUsageDate,
        weeklyRetryAt,
        weeklyLimitMicroEur,
        weeklyUsedMicroEur,
        weeklyReservedMicroEur,
        weeklyRemainingMicroEur,
        spendableMicroEur,
        usedInputTokens,
        usedOutputTokens,
        usedTotalTokens,
        trialChatDaysUsed,
        trialChatDaysLimit,
        disabled,
        blockedReason,
    };
}

export async function reserveAiChatUsage({
    accountId,
    conversationId,
    estimatedCostMicroEur,
    model,
    now = new Date(),
    requestId,
    userId,
}: {
    accountId: string;
    conversationId: string;
    estimatedCostMicroEur: number;
    model: string;
    now?: Date;
    requestId: string;
    userId: string;
}) {
    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select ${accounts.id} from ${accounts} where ${accounts.id} = ${accountId} for update;`,
        );

        const limitState = await getAiChatAccountLimitState(
            accountId,
            now,
            tx as DatabaseClient,
        );
        const dailyLimitExceeded =
            limitState.remainingMicroEur < estimatedCostMicroEur;
        const weeklyLimitExceeded =
            limitState.weeklyRemainingMicroEur < estimatedCostMicroEur;
        if (
            limitState.blockedReason ||
            dailyLimitExceeded ||
            weeklyLimitExceeded
        ) {
            return {
                ok: false as const,
                limitState,
                exceededPeriod: weeklyLimitExceeded
                    ? ('week' as const)
                    : dailyLimitExceeded
                      ? ('day' as const)
                      : null,
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
            reservedMicroEur: estimatedCostMicroEur,
        });

        return {
            ok: true as const,
            ledgerId: id,
            limitState,
        };
    });
}

export async function finalizeAiChatUsage({
    billedTotalMicroEur,
    cacheReadTokens,
    cacheWriteTokens,
    inputTokens,
    ledgerId,
    noCacheTokens,
    outputTokens,
    pricing,
    totalTokens,
}: {
    billedTotalMicroEur?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    inputTokens: number;
    ledgerId: string;
    noCacheTokens?: number;
    outputTokens: number;
    pricing: AiChatPricing;
    totalTokens?: number;
}) {
    const estimatedCost = calculateAiChatUsageCostMicroEur({
        cacheReadTokens,
        cacheWriteTokens,
        inputTokens,
        noCacheTokens,
        outputTokens,
        pricing,
    });
    const cost = {
        ...estimatedCost,
        // The component amounts remain useful diagnostics, while the total is
        // the authoritative Gateway charge when it is available.
        totalMicroEur:
            billedTotalMicroEur == null
                ? estimatedCost.totalMicroEur
                : finiteNonNegativeInteger(billedTotalMicroEur),
    };

    await storage()
        .update(aiUsageLedger)
        .set({
            status: 'finalized',
            inputTokens: finiteNonNegativeInteger(inputTokens),
            outputTokens: finiteNonNegativeInteger(outputTokens),
            totalTokens: finiteNonNegativeInteger(
                totalTokens ?? inputTokens + outputTokens,
            ),
            inputMicroEur: cost.inputMicroEur,
            outputMicroEur: cost.outputMicroEur,
            totalMicroEur: cost.totalMicroEur,
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
            reservedMicroEur: 0,
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
        if (existing.accountId !== accountId || existing.userId !== userId) {
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

export async function getAiChatConversationsForUser({
    accountId,
    limit = 50,
    userId,
}: {
    accountId: string;
    limit?: number;
    userId: string;
}) {
    return storage().query.aiChatConversations.findMany({
        columns: {
            id: true,
            title: true,
            model: true,
            gardenId: true,
            raisedBedId: true,
            createdAt: true,
            lastMessageAt: true,
        },
        where: and(
            eq(aiChatConversations.accountId, accountId),
            eq(aiChatConversations.userId, userId),
        ),
        orderBy: desc(aiChatConversations.lastMessageAt),
        limit: Math.min(100, Math.max(1, limit)),
        with: {
            messages: {
                columns: {
                    parts: true,
                    role: true,
                },
                where: eq(aiChatMessages.role, 'user'),
                orderBy: aiChatMessages.createdAt,
                limit: 1,
            },
        },
    });
}

export async function getAiChatConversationForUser({
    accountId,
    conversationId,
    userId,
}: {
    accountId: string;
    conversationId: string;
    userId: string;
}) {
    return storage().query.aiChatConversations.findFirst({
        where: and(
            eq(aiChatConversations.id, conversationId),
            eq(aiChatConversations.accountId, accountId),
            eq(aiChatConversations.userId, userId),
        ),
        with: {
            messages: {
                orderBy: aiChatMessages.createdAt,
            },
        },
    });
}

export async function updateAiChatConversationTitle({
    accountId,
    conversationId,
    title,
    userId,
}: {
    accountId: string;
    conversationId: string;
    title: string;
    userId: string;
}) {
    await storage()
        .update(aiChatConversations)
        .set({ title })
        .where(
            and(
                eq(aiChatConversations.id, conversationId),
                eq(aiChatConversations.accountId, accountId),
                eq(aiChatConversations.userId, userId),
            ),
        );
}

export async function replaceAiChatMessages({
    approvedByUserId,
    conversationId,
    messages,
}: {
    approvedByUserId?: string;
    conversationId: string;
    messages: unknown[];
}) {
    const normalizedMessages = normalizeAiChatMessagesForStorage(messages);

    await storage().transaction(async (tx) => {
        const existingToolCalls = await tx
            .select()
            .from(aiChatToolCalls)
            .where(eq(aiChatToolCalls.conversationId, conversationId));
        const existingToolCallsById = new Map(
            existingToolCalls.flatMap((toolCall) =>
                toolCall.toolCallId ? [[toolCall.toolCallId, toolCall]] : [],
            ),
        );

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
            approvedByUserId,
            existingToolCallsById,
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
                    totals.reservedMicroEur += row.reservedMicroEur;
                }
                return totals;
            }

            totals.count += 1;
            totals.inputTokens += row.inputTokens;
            totals.outputTokens += row.outputTokens;
            totals.totalTokens += row.totalTokens;
            totals.totalMicroEur += row.totalMicroEur;
            return totals;
        },
        {
            count: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            totalMicroEur: 0,
            reservedMicroEur: 0,
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
    activeDailyLimitMicroEur,
    activeWeeklyLimitMicroEur,
    disabled,
    notes,
    trialChatDays,
    trialDailyLimitMicroEur,
    trialWeeklyLimitMicroEur,
    updatedByUserId,
}: {
    accountId: string;
    activeDailyLimitMicroEur?: number | null;
    activeWeeklyLimitMicroEur?: number | null;
    disabled?: boolean;
    notes?: string | null;
    trialChatDays?: number | null;
    trialDailyLimitMicroEur?: number | null;
    trialWeeklyLimitMicroEur?: number | null;
    updatedByUserId?: string | null;
}) {
    const values = {
        accountId,
        activeDailyLimitMicroEur,
        activeWeeklyLimitMicroEur,
        disabled,
        notes,
        trialChatDays,
        trialDailyLimitMicroEur,
        trialWeeklyLimitMicroEur,
        updatedByUserId,
    };

    await storage()
        .insert(aiAccountLimitOverrides)
        .values(values)
        .onConflictDoUpdate({
            target: aiAccountLimitOverrides.accountId,
            set: {
                activeDailyLimitMicroEur,
                activeWeeklyLimitMicroEur,
                disabled,
                notes,
                trialChatDays,
                trialDailyLimitMicroEur,
                trialWeeklyLimitMicroEur,
                updatedByUserId,
                updatedAt: sql`now()`,
            },
        });
}
