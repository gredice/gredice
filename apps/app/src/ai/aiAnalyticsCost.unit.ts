import assert from 'node:assert/strict';
import test from 'node:test';
import {
    estimateAiAnalysisCostEur,
    sumAiAnalysisCostEur,
} from './aiAnalyticsCost';

test('estimateAiAnalysisCostEur calculates standard GPT-5.6 Terra usage cost in euros', () => {
    const cost = estimateAiAnalysisCostEur({
        model: 'openai/gpt-5.6-terra',
        inputTokens: 200_000,
        outputTokens: 100_000,
    });

    assert.strictEqual(cost, 1.76);
});

test('estimateAiAnalysisCostEur applies GPT-5.6 Terra long-context multipliers', () => {
    const cost = estimateAiAnalysisCostEur({
        model: 'gpt-5.6-terra',
        inputTokens: 300_000,
        outputTokens: 100_000,
    });

    assert.strictEqual(cost, 3.3);
});

test('estimateAiAnalysisCostEur calculates standard GPT-5.5 usage cost', () => {
    const cost = estimateAiAnalysisCostEur({
        model: 'openai/gpt-5.5',
        inputTokens: 200_000,
        outputTokens: 100_000,
    });

    assert.strictEqual(cost, 3.52);
});

test('estimateAiAnalysisCostEur applies GPT-5.5 long-context multipliers', () => {
    const cost = estimateAiAnalysisCostEur({
        model: 'gpt-5.5',
        inputTokens: 300_000,
        outputTokens: 100_000,
    });

    assert.strictEqual(cost, 6.6);
});

test('estimateAiAnalysisCostEur returns null for unknown model pricing', () => {
    const cost = estimateAiAnalysisCostEur({
        model: 'unknown/model',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
    });

    assert.strictEqual(cost, null);
});

test('sumAiAnalysisCostEur ignores unpriced events', () => {
    const cost = sumAiAnalysisCostEur([
        {
            data: {
                model: 'openai/gpt-5.4-mini',
                inputTokens: 1_000_000,
                outputTokens: 1_000_000,
            },
        },
        {
            data: {
                model: 'unpriced-model',
                inputTokens: 1_000_000,
                outputTokens: 1_000_000,
            },
        },
    ]);

    assert.strictEqual(cost, 4.62);
});
