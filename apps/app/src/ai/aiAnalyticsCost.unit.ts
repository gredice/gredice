import assert from 'node:assert/strict';
import test from 'node:test';
import {
    estimateAiAnalysisCostUsd,
    sumAiAnalysisCostUsd,
} from './aiAnalyticsCost';

test('estimateAiAnalysisCostUsd calculates standard GPT-5.6 Terra usage cost', () => {
    const cost = estimateAiAnalysisCostUsd({
        model: 'openai/gpt-5.6-terra',
        inputTokens: 200_000,
        outputTokens: 100_000,
    });

    assert.strictEqual(cost, 2);
});

test('estimateAiAnalysisCostUsd applies GPT-5.6 Terra long-context multipliers', () => {
    const cost = estimateAiAnalysisCostUsd({
        model: 'gpt-5.6-terra',
        inputTokens: 300_000,
        outputTokens: 100_000,
    });

    assert.strictEqual(cost, 3.75);
});

test('estimateAiAnalysisCostUsd calculates standard GPT-5.5 usage cost', () => {
    const cost = estimateAiAnalysisCostUsd({
        model: 'openai/gpt-5.5',
        inputTokens: 200_000,
        outputTokens: 100_000,
    });

    assert.strictEqual(cost, 4);
});

test('estimateAiAnalysisCostUsd applies GPT-5.5 long-context multipliers', () => {
    const cost = estimateAiAnalysisCostUsd({
        model: 'gpt-5.5',
        inputTokens: 300_000,
        outputTokens: 100_000,
    });

    assert.strictEqual(cost, 7.5);
});

test('estimateAiAnalysisCostUsd returns null for unknown model pricing', () => {
    const cost = estimateAiAnalysisCostUsd({
        model: 'unknown/model',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
    });

    assert.strictEqual(cost, null);
});

test('sumAiAnalysisCostUsd ignores unpriced events', () => {
    const cost = sumAiAnalysisCostUsd([
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

    assert.strictEqual(cost, 5.25);
});
