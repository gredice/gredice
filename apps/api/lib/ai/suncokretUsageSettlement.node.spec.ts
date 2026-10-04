import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateAiChatUsageCostMicroEur,
    type finalizeAiChatUsage,
} from '@gredice/storage';
import { simulateReadableStream, streamText } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { getSuncokretGatewayBilledCostMicroEur } from './suncokretModels';
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

test('settlement limits polling to remaining invocation runtime and falls back before termination', async (t) => {
    const warning = t.mock.method(console, 'warn', () => {});
    const background: Promise<unknown>[] = [];
    const finalized: Parameters<typeof finalizeAiChatUsage>[0][] = [];
    let lookupSignal: AbortSignal | undefined;
    scheduleSuncokretUsageSettlement({
        context,
        steps,
        usage,
        // A late chat has just 5,020ms remaining: poll for 20ms, retaining
        // 5,000ms to persist the fallback before the invocation is killed.
        invocationDeadline: new Date(5_020),
        now: () => 0,
        loadBilledCost: (lookupSteps, _load, _wait, timeoutMs) => {
            assert.equal(timeoutMs, 20);
            return getSuncokretGatewayBilledCostMicroEur(
                lookupSteps,
                async (_, signal) => {
                    lookupSignal = signal;
                    return new Promise<never>(() => {});
                },
                undefined,
                timeoutMs,
            );
        },
        finalize: async (input) => {
            finalized.push(input);
            return calculateAiChatUsageCostMicroEur(input);
        },
        schedule: (task) => {
            background.push(task);
        },
    });
    assert.equal(finalized.length, 0);
    await Promise.all(background);
    assert.equal(lookupSignal?.aborted, true);
    assert.equal(warning.mock.callCount(), 1);
    assert.equal(finalized.length, 1);
    assert.equal(finalized[0]?.billedTotalMicroEur, undefined);
});

test('settlement skips Gateway polling when only persistence headroom remains', async (t) => {
    const warning = t.mock.method(console, 'warn', () => {});
    for (const deadline of [5_000, 4_000, -1]) {
        const background: Promise<unknown>[] = [];
        const finalize = t.mock.fn(
            async (input: Parameters<typeof finalizeAiChatUsage>[0]) => {
                assert.equal(input.billedTotalMicroEur, undefined);
                return calculateAiChatUsageCostMicroEur(input);
            },
        );
        scheduleSuncokretUsageSettlement({
            context,
            steps,
            usage,
            invocationDeadline: new Date(deadline),
            now: () => 0,
            loadBilledCost: async () => {
                assert.fail('Polling must not consume persistence headroom');
            },
            finalize,
            schedule: (task) => {
                background.push(task);
            },
        });
        await Promise.all(background);
        assert.equal(finalize.mock.callCount(), 1);
    }
    assert.equal(warning.mock.callCount(), 3);
});

test('settlement keeps the bounded lookup window with ample or unavailable invocation time', async () => {
    for (const invocationDeadline of [undefined, new Date(300_000)]) {
        const background: Promise<unknown>[] = [];
        scheduleSuncokretUsageSettlement({
            context,
            steps,
            usage,
            invocationDeadline,
            now: () => 0,
            loadBilledCost: async (_, _load, _wait, timeoutMs) => {
                assert.equal(timeoutMs, 90_000);
                return 200;
            },
            finalize: async (input) => {
                assert.equal(input.billedTotalMicroEur, 200);
                return calculateAiChatUsageCostMicroEur(input);
            },
            schedule: (task) => {
                background.push(task);
            },
        });
        await Promise.all(background);
    }
});
