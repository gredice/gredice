import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateAiChatUsageCostMicroEur,
    type finalizeAiChatUsage,
} from '@gredice/storage';
import { simulateReadableStream, streamText } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { scheduleSuncokretUsageSettlement } from './suncokretUsageSettlement';

const context = {
    accountId: 'test-account',
    conversationId: 'test-conversation',
    modelId: 'openai/gpt-6-luna',
    requestId: 'test-request',
};
const usage = {
    ledgerId: 'current-request-ledger',
    inputTokens: 1000,
    outputTokens: 100,
    totalTokens: 1100,
    pricing: { inputEurPerMillionTokens: 0.1, outputEurPerMillionTokens: 0.5 },
};
const steps = [{ providerMetadata: { gateway: { generationId: 'gen_test' } } }];

test('chat stream finishes while billed cost is pending without finalizing the reservation', async () => {
    const billed = Promise.withResolvers<number | null>();
    const background: Promise<unknown>[] = [];
    const finalized: Parameters<typeof finalizeAiChatUsage>[0][] = [];
    let finishCost:
        | ReturnType<typeof calculateAiChatUsageCostMicroEur>
        | undefined;
    const result = streamText({
        model: new MockLanguageModelV4({
            doStream: {
                stream: simulateReadableStream({
                    chunks: [
                        { type: 'stream-start', warnings: [] },
                        { type: 'text-start', id: 'text' },
                        { type: 'text-delta', id: 'text', delta: 'Odgovor' },
                        { type: 'text-end', id: 'text' },
                        {
                            type: 'finish',
                            finishReason: { unified: 'stop', raw: 'stop' },
                            usage: {
                                inputTokens: {
                                    total: 1000,
                                    noCache: 1000,
                                    cacheRead: 0,
                                    cacheWrite: 0,
                                },
                                outputTokens: {
                                    total: 100,
                                    text: 100,
                                    reasoning: 0,
                                },
                            },
                        },
                    ],
                    initialDelayInMs: null,
                    chunkDelayInMs: null,
                }),
            },
        }),
        prompt: 'Pozdrav',
        onFinish: () => {
            finishCost = scheduleSuncokretUsageSettlement({
                context,
                steps,
                usage,
                loadBilledCost: () => billed.promise,
                schedule: (task) => {
                    background.push(task);
                },
                finalize: async (input) => {
                    finalized.push(input);
                    return calculateAiChatUsageCostMicroEur(input);
                },
            });
        },
    });
    const response = result.toUIMessageStreamResponse({
        messageMetadata: ({ part }) =>
            part.type === 'finish' ? { cost: finishCost } : undefined,
    });
    try {
        const stream = await response.text();
        assert.ok(stream.includes('Odgovor'));
        assert.ok(stream.includes('"type":"finish"'));
        assert.equal(background.length, 1);
        assert.equal(finalized.length, 0);
        assert.equal(finishCost?.totalMicroEur, 150);
    } finally {
        billed.resolve(200);
        await Promise.all(background);
    }
    assert.equal(finalized.length, 1);
    assert.equal(finalized[0]?.ledgerId, usage.ledgerId);
    assert.equal(finalized[0]?.billedTotalMicroEur, 200);
});

test('unavailable or failed billed lookup settles the current reservation using a token estimate once', async (t) => {
    const warning = t.mock.method(console, 'warn', () => {});
    for (const loadBilledCost of [
        async () => null,
        async () => {
            throw new Error('Usage event not found after retries');
        },
    ]) {
        const background: Promise<unknown>[] = [];
        const finalize = t.mock.fn(
            async (input: Parameters<typeof finalizeAiChatUsage>[0]) => {
                assert.equal(input.ledgerId, usage.ledgerId);
                assert.equal(input.billedTotalMicroEur, undefined);
                return calculateAiChatUsageCostMicroEur(input);
            },
        );
        const cost = scheduleSuncokretUsageSettlement({
            context,
            steps,
            usage,
            loadBilledCost,
            finalize,
            schedule: (task) => {
                background.push(task);
            },
        });
        assert.equal(cost.totalMicroEur, 150);
        await Promise.all(background);
        assert.equal(finalize.mock.callCount(), 1);
    }
    assert.equal(warning.mock.callCount(), 2);
    for (const call of warning.mock.calls) {
        assert.deepEqual(call.arguments[1], {
            ...context,
            ledgerId: usage.ledgerId,
            generationIds: ['gen_test'],
            ...(call.arguments[1]?.error
                ? { error: call.arguments[1].error }
                : {}),
        });
    }
});

test('settlement preserves zero billed cost and reports persistence failure without retrying or releasing quota', async (t) => {
    const error = t.mock.method(console, 'error', () => {});
    const background: Promise<unknown>[] = [];
    const finalize = t.mock.fn(
        async (input: Parameters<typeof finalizeAiChatUsage>[0]) => {
            assert.equal(input.billedTotalMicroEur, 0);
            throw new Error('Database unavailable');
        },
    );
    scheduleSuncokretUsageSettlement({
        context,
        steps,
        usage,
        finalize,
        loadBilledCost: async () => 0,
        schedule: (task) => {
            background.push(task);
        },
    });
    await Promise.all(background);
    assert.equal(finalize.mock.callCount(), 1);
    assert.equal(error.mock.callCount(), 1);
});
