import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    aiChatUsageDateKey,
    aiUsageLedger,
    calculateAiChatUsageCostMicroUsd,
    createUserWithPassword,
    ensureAiChatConversation,
    getAccountGardens,
    getAiChatAccountLimitState,
    getUser,
    normalizeAiChatMessagesForStorage,
    reserveAiChatUsage,
    SUNCOKRET_ACTIVE_DAILY_LIMIT_MICRO_USD,
    SUNCOKRET_AI_FEATURE,
    SUNCOKRET_TRIAL_CHAT_DAYS,
    SUNCOKRET_TRIAL_DAILY_LIMIT_MICRO_USD,
    storage,
    updateAccountTimeZone,
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

test('getAiChatAccountLimitState gives active raised-bed accounts a $1 daily cap', async () => {
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
        state.dailyLimitMicroUsd,
        SUNCOKRET_ACTIVE_DAILY_LIMIT_MICRO_USD,
    );
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
        state.dailyLimitMicroUsd,
        SUNCOKRET_TRIAL_DAILY_LIMIT_MICRO_USD,
    );
    assert.strictEqual(state.trialChatDaysLimit, SUNCOKRET_TRIAL_CHAT_DAYS);
    assert.strictEqual(state.blockedReason, null);
});

test('getAiChatAccountLimitState blocks trial accounts after five used chat days', async () => {
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
                totalMicroUsd: 1,
            })),
        );

    const state = await getAiChatAccountLimitState(
        accountId,
        new Date('2026-06-21T10:00:00Z'),
    );

    assert.strictEqual(state.trialChatDaysUsed, SUNCOKRET_TRIAL_CHAT_DAYS);
    assert.strictEqual(state.blockedReason, 'trial_days_exhausted');
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

    const results = await Promise.all([
        reserveAiChatUsage({
            accountId,
            conversationId,
            estimatedCostMicroUsd: 70_000,
            model: 'openai/gpt-5.5',
            requestId: randomUUID(),
            userId,
        }),
        reserveAiChatUsage({
            accountId,
            conversationId,
            estimatedCostMicroUsd: 70_000,
            model: 'openai/gpt-5.5',
            requestId: randomUUID(),
            userId,
        }),
    ]);

    assert.strictEqual(results.filter((result) => result.ok).length, 1);
    assert.strictEqual(results.filter((result) => !result.ok).length, 1);
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

test('calculateAiChatUsageCostMicroUsd rounds input and output token costs', () => {
    const cost = calculateAiChatUsageCostMicroUsd({
        inputTokens: 1200,
        outputTokens: 300,
        pricing: {
            inputUsdPerMillionTokens: 2.5,
            outputUsdPerMillionTokens: 15,
        },
    });

    assert.deepStrictEqual(cost, {
        inputMicroUsd: 3000,
        outputMicroUsd: 4500,
        totalMicroUsd: 7500,
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
