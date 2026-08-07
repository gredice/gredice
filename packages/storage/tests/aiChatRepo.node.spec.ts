import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    aiChatUsageDateKey,
    aiUsageLedger,
    calculateAiChatUsageCostMicroEur,
    createUserWithPassword,
    ensureAiChatConversation,
    getAccountGardens,
    getAiChatAccountLimitState,
    getAiChatConversationForUser,
    getAiChatConversationsForUser,
    getUser,
    normalizeAiChatMessagesForStorage,
    replaceAiChatMessages,
    reserveAiChatUsage,
    SUNCOKRET_ACTIVE_DAILY_LIMIT_MICRO_EUR,
    SUNCOKRET_ACTIVE_WEEKLY_LIMIT_MICRO_EUR,
    SUNCOKRET_AI_FEATURE,
    SUNCOKRET_TRIAL_CHAT_DAYS,
    SUNCOKRET_TRIAL_DAILY_LIMIT_MICRO_EUR,
    SUNCOKRET_TRIAL_WEEKLY_LIMIT_MICRO_EUR,
    storage,
    updateAccountTimeZone,
    updateAiChatConversationTitle,
    updateRaisedBed,
} from '@gredice/storage';
import { ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createAiChatTestUser() {
    await ensureFarmId();
    const userName = `suncokret-${randomUUID()}@example.test`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    const accountId = user?.accounts[0]?.accountId;
    assert.ok(accountId);

    return { accountId, userId };
}

test('getAiChatAccountLimitState gives active raised-bed accounts euro caps', async () => {
    createTestDb();
    const { accountId } = await createAiChatTestUser();
    const gardens = await getAccountGardens(accountId);
    const raisedBed = gardens.flatMap((garden) => garden.raisedBeds)[0];
    assert.ok(raisedBed);

    await updateRaisedBed({ id: raisedBed.id, status: 'active' });

    const state = await getAiChatAccountLimitState(
        accountId,
        new Date('2026-06-21T10:00:00Z'),
    );

    assert.strictEqual(state.activeRaisedBed, true);
    assert.strictEqual(state.tier, 'active-raised-bed');
    assert.strictEqual(
        state.dailyLimitMicroEur,
        SUNCOKRET_ACTIVE_DAILY_LIMIT_MICRO_EUR,
    );
    assert.strictEqual(state.dailyLimitMicroEur, 800_000);
    assert.strictEqual(
        state.weeklyLimitMicroEur,
        SUNCOKRET_ACTIVE_WEEKLY_LIMIT_MICRO_EUR,
    );
    assert.strictEqual(state.weeklyLimitMicroEur, 3_000_000);
    assert.strictEqual(state.blockedReason, null);
});

test('getAiChatAccountLimitState gives no-active-bed accounts a trial cap', async () => {
    createTestDb();
    const { accountId } = await createAiChatTestUser();

    const state = await getAiChatAccountLimitState(
        accountId,
        new Date('2026-06-21T10:00:00Z'),
    );

    assert.strictEqual(state.activeRaisedBed, false);
    assert.strictEqual(state.tier, 'trial-no-active-bed');
    assert.strictEqual(
        state.dailyLimitMicroEur,
        SUNCOKRET_TRIAL_DAILY_LIMIT_MICRO_EUR,
    );
    assert.strictEqual(state.dailyLimitMicroEur, 300_000);
    assert.strictEqual(
        state.weeklyLimitMicroEur,
        SUNCOKRET_TRIAL_WEEKLY_LIMIT_MICRO_EUR,
    );
    assert.strictEqual(state.weeklyLimitMicroEur, 800_000);
    assert.strictEqual(state.trialChatDaysLimit, SUNCOKRET_TRIAL_CHAT_DAYS);
    assert.strictEqual(state.trialChatDaysLimit, 3);
    assert.strictEqual(state.blockedReason, null);
});

test('getAiChatAccountLimitState reports finalized token usage in the rolling day', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();

    await storage()
        .insert(aiUsageLedger)
        .values([
            {
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate: '2026-06-21',
                status: 'finalized',
                inputTokens: 800,
                outputTokens: 200,
                totalTokens: 1_000,
                totalMicroEur: 1,
                createdAt: new Date('2026-06-21T09:00:00Z'),
            },
            {
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate: '2026-06-21',
                status: 'reserved',
                inputTokens: 400,
                outputTokens: 100,
                totalTokens: 500,
                reservedMicroEur: 1,
                createdAt: new Date('2026-06-21T09:30:00Z'),
            },
        ]);

    const state = await getAiChatAccountLimitState(
        accountId,
        new Date('2026-06-21T10:00:00Z'),
    );

    assert.strictEqual(state.usedInputTokens, 800);
    assert.strictEqual(state.usedOutputTokens, 200);
    assert.strictEqual(state.usedTotalTokens, 1_000);
});

test('getAiChatAccountLimitState uses a rolling 24-hour window across midnight', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();

    await storage()
        .insert(aiUsageLedger)
        .values([
            {
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate: '2026-06-20',
                status: 'finalized',
                totalMicroEur: 40_000,
                createdAt: new Date('2026-06-20T09:59:59Z'),
            },
            {
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate: '2026-06-20',
                status: 'finalized',
                totalMicroEur: 60_000,
                createdAt: new Date('2026-06-20T10:30:00Z'),
            },
        ]);

    const state = await getAiChatAccountLimitState(
        accountId,
        new Date('2026-06-21T10:00:00Z'),
    );

    assert.strictEqual(state.usedMicroEur, 60_000);
    assert.strictEqual(state.dailyWindowStartedAt, '2026-06-20T10:00:00.000Z');
    assert.strictEqual(state.dailyRetryAt, '2026-06-21T10:30:00.000Z');
});

test('getAiChatAccountLimitState reports current ISO week usage', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();

    await storage()
        .insert(aiUsageLedger)
        .values([
            {
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate: '2026-06-14',
                status: 'finalized',
                totalMicroEur: 90,
            },
            {
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate: '2026-06-15',
                status: 'finalized',
                totalMicroEur: 30,
            },
            {
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate: '2026-06-21',
                status: 'reserved',
                reservedMicroEur: 20,
            },
        ]);

    const state = await getAiChatAccountLimitState(
        accountId,
        new Date('2026-06-21T10:00:00Z'),
    );

    assert.strictEqual(state.weekStartUsageDate, '2026-06-15');
    assert.strictEqual(state.weeklyUsedMicroEur, 30);
    assert.strictEqual(state.weeklyReservedMicroEur, 20);
    assert.strictEqual(
        state.weeklyLimitMicroEur,
        SUNCOKRET_TRIAL_WEEKLY_LIMIT_MICRO_EUR,
    );
    assert.strictEqual(
        state.weeklyRemainingMicroEur,
        state.weeklyLimitMicroEur - 50,
    );
});

test('getAiChatAccountLimitState blocks trial accounts after three used chat days', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();

    await storage()
        .insert(aiUsageLedger)
        .values(
            Array.from({ length: SUNCOKRET_TRIAL_CHAT_DAYS }, (_, index) => ({
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate: `2026-06-0${index + 1}`,
                status: 'finalized',
                totalMicroEur: 1,
            })),
        );

    const state = await getAiChatAccountLimitState(
        accountId,
        new Date('2026-06-21T10:00:00Z'),
    );

    assert.strictEqual(state.trialChatDaysUsed, SUNCOKRET_TRIAL_CHAT_DAYS);
    assert.strictEqual(state.blockedReason, 'trial_days_exhausted');
});

test('getAiChatAccountLimitState allows trial users to finish their final trial day', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();
    const usageDates = Array.from(
        { length: SUNCOKRET_TRIAL_CHAT_DAYS },
        (_, index) => `2026-06-0${index + 1}`,
    );
    const finalUsageDate = usageDates.at(-1);
    assert.ok(finalUsageDate);

    await storage()
        .insert(aiUsageLedger)
        .values(
            usageDates.map((usageDate) => ({
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate,
                status: 'finalized',
                totalMicroEur: 1,
            })),
        );

    const state = await getAiChatAccountLimitState(
        accountId,
        new Date(`${finalUsageDate}T10:00:00Z`),
    );

    assert.strictEqual(state.trialChatDaysUsed, SUNCOKRET_TRIAL_CHAT_DAYS);
    assert.strictEqual(state.blockedReason, null);
    assert.ok(state.remainingMicroEur > 0);
});

test('reserveAiChatUsage serializes concurrent reservations for the daily cap', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();
    const conversationId = randomUUID();
    const conversation = await ensureAiChatConversation({
        id: conversationId,
        accountId,
        userId,
        model: 'openai/gpt-5.5',
        title: 'Suncokret test',
    });
    assert.ok(conversation);
    const now = new Date('2026-06-21T10:00:00Z');

    const results = await Promise.all([
        reserveAiChatUsage({
            accountId,
            conversationId,
            estimatedCostMicroEur: 200_000,
            model: 'openai/gpt-5.5',
            now,
            requestId: randomUUID(),
            userId,
        }),
        reserveAiChatUsage({
            accountId,
            conversationId,
            estimatedCostMicroEur: 200_000,
            model: 'openai/gpt-5.5',
            now,
            requestId: randomUUID(),
            userId,
        }),
    ]);

    assert.strictEqual(results.filter((result) => result.ok).length, 1);
    assert.strictEqual(results.filter((result) => !result.ok).length, 1);
});

test('reserveAiChatUsage enforces the independent weekly cap', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();
    const gardens = await getAccountGardens(accountId);
    const raisedBed = gardens.flatMap((garden) => garden.raisedBeds)[0];
    assert.ok(raisedBed);
    await updateRaisedBed({ id: raisedBed.id, status: 'active' });

    const conversationId = randomUUID();
    await ensureAiChatConversation({
        id: conversationId,
        accountId,
        userId,
        model: 'openai/gpt-5.5',
        title: 'Suncokret weekly limit test',
    });
    await storage()
        .insert(aiUsageLedger)
        .values(
            Array.from({ length: 5 }, (_, index) => ({
                id: randomUUID(),
                accountId,
                userId,
                requestId: randomUUID(),
                feature: SUNCOKRET_AI_FEATURE,
                model: 'openai/gpt-5.5',
                usageDate: `2026-06-${(15 + index).toString()}`,
                status: 'finalized',
                totalMicroEur: 500_000,
                createdAt: new Date(
                    `2026-06-${(15 + index).toString()}T10:00:00Z`,
                ),
            })),
        );

    const result = await reserveAiChatUsage({
        accountId,
        conversationId,
        estimatedCostMicroEur: 600_000,
        model: 'openai/gpt-5.5',
        now: new Date('2026-06-21T12:00:00Z'),
        requestId: randomUUID(),
        userId,
    });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
        assert.strictEqual(result.exceededPeriod, 'week');
        assert.strictEqual(result.limitState.remainingMicroEur, 800_000);
        assert.strictEqual(result.limitState.weeklyRemainingMicroEur, 500_000);
    }
});

test('aiChatUsageDateKey respects account timezone and falls back to Zagreb', async () => {
    createTestDb();
    const { accountId } = await createAiChatTestUser();
    await updateAccountTimeZone(accountId, 'Not/A_Timezone');

    const state = await getAiChatAccountLimitState(
        accountId,
        new Date('2026-06-21T22:30:00Z'),
    );

    assert.strictEqual(state.timeZone, 'Europe/Zagreb');
    assert.strictEqual(state.usageDate, '2026-06-22');
    assert.strictEqual(
        aiChatUsageDateKey(new Date('2026-06-21T22:30:00Z'), 'UTC'),
        '2026-06-21',
    );
});

test('calculateAiChatUsageCostMicroEur rounds input and output token costs', () => {
    const cost = calculateAiChatUsageCostMicroEur({
        inputTokens: 1200,
        outputTokens: 300,
        pricing: {
            inputEurPerMillionTokens: 2.5,
            outputEurPerMillionTokens: 15,
        },
    });

    assert.deepStrictEqual(cost, {
        inputMicroEur: 3000,
        outputMicroEur: 4500,
        totalMicroEur: 7500,
    });
});

test('calculateAiChatUsageCostMicroEur applies cached input token pricing', () => {
    const cost = calculateAiChatUsageCostMicroEur({
        inputTokens: 1200,
        noCacheTokens: 700,
        cacheReadTokens: 400,
        cacheWriteTokens: 100,
        outputTokens: 300,
        pricing: {
            inputEurPerMillionTokens: 2,
            outputEurPerMillionTokens: 10,
            cachedInputEurPerMillionTokens: 0.2,
            cacheWriteInputEurPerMillionTokens: 2.5,
        },
    });

    assert.deepStrictEqual(cost, {
        inputMicroEur: 1730,
        outputMicroEur: 3000,
        totalMicroEur: 4730,
    });
});

test('normalizeAiChatMessagesForStorage keeps valid UI message payloads', () => {
    const messages = normalizeAiChatMessagesForStorage([
        null,
        {
            id: 'message-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Kako je vrt?' }, null],
            metadata: { model: 'openai/gpt-5.5' },
        },
        {
            role: 'assistant',
            parts: 'invalid',
        },
    ]);

    assert.strictEqual(messages.length, 2);
    assert.deepStrictEqual(messages[0], {
        id: 'message-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Kako je vrt?' }],
        metadata: { model: 'openai/gpt-5.5' },
    });
    assert.strictEqual(messages[1].role, 'assistant');
    assert.deepStrictEqual(messages[1].parts, []);
});

test('replaceAiChatMessages records approved tool requests for audit', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();
    const conversationId = randomUUID();
    await ensureAiChatConversation({
        id: conversationId,
        accountId,
        userId,
        model: 'openai/gpt-5.5',
        title: 'Suncokret approval test',
    });

    await replaceAiChatMessages({
        approvedByUserId: userId,
        conversationId,
        messages: [
            {
                id: 'assistant-approval',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-addProductToCart',
                        toolCallId: 'cart-call-1',
                        state: 'approval-responded',
                        input: { productId: 'plant-sort-458' },
                        approval: {
                            id: 'approval-1',
                            approved: true,
                        },
                    },
                ],
            },
        ],
    });

    const toolCalls = await storage().query.aiChatToolCalls.findMany();
    const toolCall = toolCalls.find(
        (candidate) => candidate.toolCallId === 'cart-call-1',
    );
    assert.ok(toolCall);
    assert.strictEqual(toolCall.state, 'approval-responded');
    assert.strictEqual(toolCall.needsApproval, true);
    assert.strictEqual(toolCall.approvedByUserId, userId);
    assert.ok(toolCall.approvedAt instanceof Date);
});

test('lists and restores user-scoped AI conversations', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();
    const conversationId = randomUUID();
    await ensureAiChatConversation({
        id: conversationId,
        accountId,
        userId,
        model: 'openai/gpt-5.5',
    });
    await replaceAiChatMessages({
        conversationId,
        messages: [
            {
                id: 'user-history',
                role: 'user',
                parts: [{ type: 'text', text: 'Kako je vrt?' }],
            },
        ],
    });
    await updateAiChatConversationTitle({
        accountId,
        conversationId,
        title: 'Stanje vrta',
        userId,
    });

    const conversations = await getAiChatConversationsForUser({
        accountId,
        userId,
    });
    assert.strictEqual(conversations[0]?.id, conversationId);
    assert.strictEqual(conversations[0]?.title, 'Stanje vrta');
    assert.strictEqual(conversations[0]?.messages[0]?.role, 'user');

    const restored = await getAiChatConversationForUser({
        accountId,
        conversationId,
        userId,
    });
    assert.strictEqual(restored?.messages[0]?.id, 'user-history');
    assert.strictEqual(restored?.messages[0]?.role, 'user');
});

test('replaceAiChatMessages records MCP correlation and error category', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();
    const conversationId = randomUUID();
    await ensureAiChatConversation({
        id: conversationId,
        accountId,
        userId,
        model: 'openai/gpt-5.5',
        title: 'Suncokret MCP error test',
    });

    await replaceAiChatMessages({
        conversationId,
        messages: [
            {
                id: 'assistant-telemetry-error',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-listGardenOperations',
                        toolCallId: 'operations-call-1',
                        state: 'output-error',
                        input: { gardenId: 1 },
                        errorText:
                            'Provjera podataka trajala je predugo. Pokušaj ponovno.',
                        mcpCorrelationId: 'mcp-correlation-123',
                        mcpErrorCategory: 'timeout',
                    },
                ],
            },
        ],
    });

    const toolCalls = await storage().query.aiChatToolCalls.findMany();
    const toolCall = toolCalls.find(
        (candidate) => candidate.toolCallId === 'operations-call-1',
    );
    assert.ok(toolCall);
    assert.strictEqual(toolCall.mcpCorrelationId, 'mcp-correlation-123');
    assert.strictEqual(
        toolCall.error,
        '[timeout] Provjera podataka trajala je predugo. Pokušaj ponovno.',
    );
});

test('replaceAiChatMessages preserves server MCP telemetry on later client snapshots', async () => {
    createTestDb();
    const { accountId, userId } = await createAiChatTestUser();
    const conversationId = randomUUID();
    await ensureAiChatConversation({
        id: conversationId,
        accountId,
        userId,
        model: 'openai/gpt-5.5',
        title: 'Suncokret MCP telemetry preservation test',
    });

    const toolPart = {
        type: 'tool-addOperationToCart',
        toolCallId: 'operation-call-1',
        state: 'output-error',
        input: { operationId: 167, raisedBedId: 498 },
        approval: { approved: true },
        errorText: 'Radnja trenutačno nije uspjela. Pokušaj ponovno.',
    };
    await replaceAiChatMessages({
        approvedByUserId: userId,
        conversationId,
        messages: [
            {
                id: 'assistant-preserve-error',
                role: 'assistant',
                parts: [
                    {
                        ...toolPart,
                        mcpCorrelationId: 'mcp-correlation-456',
                        mcpErrorCategory: 'tool_failure',
                    },
                ],
            },
        ],
    });

    const initialToolCall = (
        await storage().query.aiChatToolCalls.findMany()
    ).find((candidate) => candidate.toolCallId === 'operation-call-1');
    assert.ok(initialToolCall);

    await replaceAiChatMessages({
        approvedByUserId: userId,
        conversationId,
        messages: [
            {
                id: 'assistant-preserve-error',
                role: 'assistant',
                parts: [toolPart],
            },
            {
                id: 'later-user-message',
                role: 'user',
                parts: [{ type: 'text', text: 'Zašto nije uspjelo?' }],
            },
        ],
    });

    const rewrittenToolCall = (
        await storage().query.aiChatToolCalls.findMany()
    ).find((candidate) => candidate.toolCallId === 'operation-call-1');
    assert.ok(rewrittenToolCall);
    assert.strictEqual(rewrittenToolCall.id, initialToolCall.id);
    assert.strictEqual(
        rewrittenToolCall.mcpCorrelationId,
        'mcp-correlation-456',
    );
    assert.strictEqual(
        rewrittenToolCall.error,
        '[tool_failure] Radnja trenutačno nije uspjela. Pokušaj ponovno.',
    );
    assert.strictEqual(
        rewrittenToolCall.approvedAt?.toISOString(),
        initialToolCall.approvedAt?.toISOString(),
    );
    assert.strictEqual(
        rewrittenToolCall.createdAt.toISOString(),
        initialToolCall.createdAt.toISOString(),
    );
});

test('normalizeAiChatMessagesForStorage does not persist provider tool protocol text', () => {
    const [message] = normalizeAiChatMessagesForStorage([
        {
            id: 'assistant-message',
            role: 'assistant',
            parts: [
                {
                    type: 'text',
                    text: '<｜｜DSML｜｜tool_calls>\n<｜｜DSML｜｜invoke name="searchDirectory">',
                },
            ],
        },
    ]);

    assert.ok(message);
    assert.deepStrictEqual(message.parts, [
        {
            type: 'text',
            text: 'Nisam uspio dovršiti odgovor. Pokušaj ponovno — ne moraš mijenjati pitanje.',
        },
    ]);
});

test('normalizeAiChatMessagesForStorage removes English model planning preambles', () => {
    const [message] = normalizeAiChatMessagesForStorage([
        {
            id: 'assistant-message',
            role: 'assistant',
            parts: [
                {
                    type: 'text',
                    text: "Confirmed: watering can be ordered. I'll answer briefly.Nažalost, prethodni odgovor nije bio točan.",
                },
            ],
        },
    ]);

    assert.ok(message);
    assert.deepStrictEqual(message.parts, [
        {
            type: 'text',
            text: 'Nažalost, prethodni odgovor nije bio točan.',
        },
    ]);
});

test('normalizeAiChatMessagesForStorage rejects spaced provider tool protocol text', () => {
    const [message] = normalizeAiChatMessagesForStorage([
        {
            id: 'assistant-message',
            role: 'assistant',
            parts: [
                {
                    type: 'text',
                    text: '< | | DSML | | tool_calls> < | | DSML | | invoke name="getRaisedBedDetails">',
                },
            ],
        },
    ]);

    assert.ok(message);
    assert.deepStrictEqual(message.parts, [
        {
            type: 'text',
            text: 'Nisam uspio dovršiti odgovor. Pokušaj ponovno — ne moraš mijenjati pitanje.',
        },
    ]);
});
