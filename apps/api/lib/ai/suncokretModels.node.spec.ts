import assert from 'node:assert/strict';
import test from 'node:test';
import { createGateway } from 'ai';
import {
    estimateSuncokretRequestCostMicroEur,
    getSuncokretGatewayBilledCostMicroEur,
    getSuncokretModel,
    getSuncokretPricedModel,
    largestSuncokretStepInputTokens,
    resolveSuncokretMaxOutputTokens,
    suncokretGatewayGenerationIds,
    suncokretPricingForInputTokens,
} from './suncokretModels';

function setEnvValue(name: string, value: string | undefined) {
    if (typeof value === 'string') {
        process.env[name] = value;
        return;
    }

    delete process.env[name];
}

function withModelEnv(
    env: {
        defaultModel?: string;
        allowlist?: string;
        usdToEurRate?: string;
    },
    callback: () => void,
) {
    const previousDefault = process.env.SUNCOKRET_AI_DEFAULT_MODEL;
    const previousAllowlist = process.env.SUNCOKRET_AI_MODEL_ALLOWLIST;
    const previousUsdToEurRate = process.env.SUNCOKRET_AI_USD_TO_EUR_RATE;

    setEnvValue('SUNCOKRET_AI_DEFAULT_MODEL', env.defaultModel);
    setEnvValue('SUNCOKRET_AI_MODEL_ALLOWLIST', env.allowlist);
    setEnvValue('SUNCOKRET_AI_USD_TO_EUR_RATE', env.usdToEurRate);

    try {
        callback();
    } finally {
        setEnvValue('SUNCOKRET_AI_DEFAULT_MODEL', previousDefault);
        setEnvValue('SUNCOKRET_AI_MODEL_ALLOWLIST', previousAllowlist);
        setEnvValue('SUNCOKRET_AI_USD_TO_EUR_RATE', previousUsdToEurRate);
    }
}

test('getSuncokretModel defaults to OpenAI GPT-6 Luna', () => {
    withModelEnv({}, () => {
        assert.equal(getSuncokretModel()?.id, 'openai/gpt-6-luna');
    });
});

test('getSuncokretModel falls back to the first enabled model for automatic selection', () => {
    withModelEnv(
        {
            allowlist: 'openai/gpt-6-luna',
        },
        () => {
            const model = getSuncokretModel();

            assert.equal(model?.id, 'openai/gpt-6-luna');
            assert.equal(model?.inputEurPerMillionTokens, 0.088);
            assert.equal(model?.outputEurPerMillionTokens, 0.44);
        },
    );
});

test('getSuncokretModel applies the configured USD to EUR rate', () => {
    withModelEnv(
        {
            allowlist: 'openai/gpt-6-luna',
            defaultModel: 'openai/gpt-6-luna',
            usdToEurRate: '0.9',
        },
        () => {
            const model = getSuncokretModel();

            assert.equal(model?.inputEurPerMillionTokens, 0.09);
            assert.equal(model?.outputEurPerMillionTokens, 0.45);
        },
    );
});

test('getSuncokretModel keeps explicit unavailable model requests invalid', () => {
    withModelEnv(
        {
            allowlist: 'openai/gpt-6-luna',
        },
        () => {
            assert.equal(getSuncokretModel('deepseek/deepseek-v4-flash'), null);
        },
    );
});

test('getSuncokretPricedModel uses current AI Gateway catalog pricing', async () => {
    await withModelEnvAsync(
        {
            allowlist: 'openai/gpt-6-luna',
        },
        async () => {
            const model = await getSuncokretPricedModel(
                'openai/gpt-6-luna',
                async () => ({
                    models: [
                        {
                            id: 'openai/gpt-6-luna',
                            name: 'GPT-6 Luna',
                            pricing: {
                                input: '0.00000015',
                                output: '0.0000009',
                                cachedInputTokens: '0.000000015',
                                cacheCreationInputTokens: '0.00000019',
                            },
                            specification: {
                                specificationVersion: 'v4',
                                provider: 'gateway',
                                modelId: 'openai/gpt-6-luna',
                            },
                            modelType: 'language',
                        },
                    ],
                }),
            );

            assert.equal(model?.inputEurPerMillionTokens, 0.132);
            assert.equal(model?.outputEurPerMillionTokens, 0.792);
            assert.equal(model?.cachedInputEurPerMillionTokens, 0.0132);
            assert.equal(model?.cacheWriteInputEurPerMillionTokens, 0.1672);
        },
    );
});

test('Suncokret Gateway billed cost sums unique generation costs', async () => {
    const steps = [
        {
            providerMetadata: {
                gateway: { generationId: 'gen_one' },
            },
        },
        {
            providerMetadata: {
                gateway: { generationId: 'gen_two' },
            },
        },
        {
            providerMetadata: {
                gateway: { generationId: 'gen_one' },
            },
        },
    ];

    assert.deepStrictEqual(suncokretGatewayGenerationIds(steps), [
        'gen_one',
        'gen_two',
    ]);
    assert.equal(
        await getSuncokretGatewayBilledCostMicroEur(steps, async (id) => ({
            id,
            totalCost: id === 'gen_one' ? 0.0123451 : 0.0000001,
            upstreamInferenceCost: 0,
            usage: 0,
            createdAt: '2026-08-05T00:00:00.000Z',
            model: 'openai/gpt-6-luna',
            isByok: false,
            providerName: 'openai',
            streamed: true,
            finishReason: 'stop',
            latency: 1,
            generationTime: 1,
            promptTokens: 1,
            completionTokens: 1,
            reasoningTokens: 0,
            cachedTokens: 0,
            cacheCreationTokens: 0,
            billableWebSearchCalls: 0,
        })),
        10_864,
    );
});

async function withModelEnvAsync(
    env: {
        defaultModel?: string;
        allowlist?: string;
        usdToEurRate?: string;
    },
    callback: () => Promise<void>,
) {
    const previousDefault = process.env.SUNCOKRET_AI_DEFAULT_MODEL;
    const previousAllowlist = process.env.SUNCOKRET_AI_MODEL_ALLOWLIST;
    const previousUsdToEurRate = process.env.SUNCOKRET_AI_USD_TO_EUR_RATE;

    setEnvValue('SUNCOKRET_AI_DEFAULT_MODEL', env.defaultModel);
    setEnvValue('SUNCOKRET_AI_MODEL_ALLOWLIST', env.allowlist);
    setEnvValue('SUNCOKRET_AI_USD_TO_EUR_RATE', env.usdToEurRate);

    try {
        await callback();
    } finally {
        setEnvValue('SUNCOKRET_AI_DEFAULT_MODEL', previousDefault);
        setEnvValue('SUNCOKRET_AI_MODEL_ALLOWLIST', previousAllowlist);
        setEnvValue('SUNCOKRET_AI_USD_TO_EUR_RATE', previousUsdToEurRate);
    }
}

test('Suncokret request estimates apply GPT-6 Luna long-context rates above 272K input tokens', () => {
    withModelEnv({}, () => {
        const model = getSuncokretModel();
        assert.ok(model);

        assert.equal(
            estimateSuncokretRequestCostMicroEur({
                inputTokens: 200_000,
                maxOutputTokens: 1_000,
                model,
            }),
            18_040,
        );
        assert.equal(
            estimateSuncokretRequestCostMicroEur({
                inputTokens: 300_000,
                maxOutputTokens: 1_000,
                model,
            }),
            53_460,
        );
    });
});

test('Suncokret output budget uses GPT-6 Luna long-context rates above 272K input tokens', () => {
    withModelEnv({}, () => {
        const model = getSuncokretModel();
        assert.ok(model);

        assert.equal(
            resolveSuncokretMaxOutputTokens({
                estimatedInputTokens: 300_000,
                model,
                remainingMicroEur: 53_000,
            }),
            303,
        );
        assert.equal(
            resolveSuncokretMaxOutputTokens({
                estimatedInputTokens: 300_000,
                model,
                remainingMicroEur: 52_000,
            }),
            0,
        );
    });
});

test('Suncokret fallback usage pricing picks the long-context tier from the largest step', () => {
    withModelEnv({}, () => {
        const model = getSuncokretModel();
        assert.ok(model);

        const steps = [
            { usage: { inputTokens: 150_000 } },
            { usage: { inputTokens: 200_000 } },
            {},
        ];
        assert.equal(largestSuncokretStepInputTokens(steps), 200_000);
        assert.equal(
            suncokretPricingForInputTokens(
                model,
                largestSuncokretStepInputTokens(steps),
            ),
            model,
        );

        const longContextPricing = suncokretPricingForInputTokens(
            model,
            largestSuncokretStepInputTokens([
                ...steps,
                { usage: { inputTokens: 280_000 } },
            ]),
        );
        assert.equal(longContextPricing.inputEurPerMillionTokens, 0.176);
        assert.equal(longContextPricing.outputEurPerMillionTokens, 0.66);
        assert.equal(longContextPricing.cachedInputEurPerMillionTokens, 0.0176);
        assert.equal(
            longContextPricing.cacheWriteInputEurPerMillionTokens,
            0.22,
        );
    });
});

function generationInfo(id: string, totalCost = 0.001) {
    return {
        id,
        totalCost,
        upstreamInferenceCost: 0,
        usage: totalCost,
        createdAt: '2026-10-02T00:00:00.000Z',
        model: 'openai/gpt-6-luna',
        isByok: false,
        providerName: 'openai',
        streamed: true,
        finishReason: 'stop',
        latency: 1,
        generationTime: 1,
        promptTokens: 1,
        completionTokens: 1,
        reasoningTokens: 0,
        cachedTokens: 0,
        cacheCreationTokens: 0,
        billableWebSearchCalls: 0,
    };
}

function usageNotFound() {
    // Exact production SDK wrapper: isRetryable is false even though the
    // ingestion delay makes this particular response safe to poll.
    return Object.assign(new Error('Invalid error response format'), {
        name: 'GatewayResponseError',
        statusCode: 404,
        isRetryable: false,
        response: { error: 'Usage event not found', id: 'gen_delayed' },
    });
}

const delayedSteps = [
    { providerMetadata: { gateway: { generationId: 'gen_ready' } } },
    { providerMetadata: { gateway: { generationId: 'gen_delayed' } } },
    { providerMetadata: { gateway: { generationId: 'gen_delayed' } } },
];

test('Gateway retries delayed usage and fetches ready and duplicate generations only once', async () => {
    await withModelEnvAsync({}, async () => {
        const calls: string[] = [];
        const delays: number[] = [];
        const billed = await getSuncokretGatewayBilledCostMicroEur(
            delayedSteps,
            async (id) => {
                calls.push(id);
                if (
                    id === 'gen_delayed' &&
                    calls.filter((x) => x === id).length < 3
                ) {
                    throw usageNotFound();
                }
                return generationInfo(id);
            },
            async (ms) => {
                delays.push(ms);
            },
        );
        assert.equal(billed, 1760);
        assert.deepEqual(delays, [1000, 2000]);
        assert.equal(calls.filter((x) => x === 'gen_ready').length, 1);
        assert.equal(calls.filter((x) => x === 'gen_delayed').length, 3);
    });
});

test('Gateway stops polling persistently missing usage after four attempts without partial billing', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const error = usageNotFound();
    await assert.rejects(
        getSuncokretGatewayBilledCostMicroEur(
            delayedSteps,
            async (id) => {
                if (id === 'gen_ready') return generationInfo(id);
                attempts++;
                throw error;
            },
            async (ms) => {
                delays.push(ms);
            },
        ),
        (caught) => caught === error,
    );
    assert.equal(attempts, 4);
    assert.deepEqual(delays, [1000, 2000, 4000]);
});

test('Gateway does not poll authentication, unrelated not-found, network or validation errors', async () => {
    for (const error of [
        Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
        Object.assign(new Error('Missing model'), {
            statusCode: 404,
            response: { error: 'Model not found' },
        }),
        new Error('Network error'),
        Object.assign(new Error('Invalid response'), { statusCode: 502 }),
    ]) {
        let attempts = 0;
        await assert.rejects(
            getSuncokretGatewayBilledCostMicroEur(
                delayedSteps.slice(0, 1),
                async () => {
                    attempts++;
                    throw error;
                },
                async () => {
                    assert.fail('Unexpected retry');
                },
            ),
            (caught) => caught === error,
        );
        assert.equal(attempts, 1);
    }
});

test('Gateway applies a shared deadline even when a lookup ignores cancellation', async () => {
    let lookupSignal: AbortSignal | undefined;
    await assert.rejects(
        getSuncokretGatewayBilledCostMicroEur(
            delayedSteps.slice(0, 1),
            async (_, signal) => {
                lookupSignal = signal;
                return new Promise<never>(() => {});
            },
            async () => {},
            10,
        ),
        /cost lookup timed out/,
    );
    assert.equal(lookupSignal?.aborted, true);
});

test('Gateway returns no billed total for missing IDs or invalid individual costs', async () => {
    assert.equal(
        await getSuncokretGatewayBilledCostMicroEur([{}], async () => {
            assert.fail('No generation to look up');
        }),
        null,
    );
    for (const totalCost of [-0.001, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(
            await getSuncokretGatewayBilledCostMicroEur(
                delayedSteps,
                async (id) =>
                    generationInfo(id, id === 'gen_ready' ? 1 : totalCost),
            ),
            null,
        );
    }
    assert.equal(
        await getSuncokretGatewayBilledCostMicroEur(
            delayedSteps.slice(0, 1),
            async () => generationInfo('wrong_id'),
        ),
        null,
    );
});

test('Gateway preserves a valid zero billed cost', async () => {
    assert.equal(
        await getSuncokretGatewayBilledCostMicroEur(delayedSteps, async (id) =>
            generationInfo(id, 0),
        ),
        0,
    );
});

test('Gateway polls both string and structured not-yet responses wrapped by the real SDK', async () => {
    for (const errorBody of [
        { error: 'Usage event not found' },
        { error: { type: 'not_found', message: 'Usage event not found' } },
    ]) {
        let polls = 0;
        const provider = createGateway({
            apiKey: 'test-only-key',
            fetch: async () => {
                polls++;
                return Response.json(errorBody, { status: 404 });
            },
        });
        let attempts = 0;
        assert.equal(
            await getSuncokretGatewayBilledCostMicroEur(
                delayedSteps.slice(0, 1),
                async (id) => {
                    attempts++;
                    if (attempts === 1)
                        return provider.getGenerationInfo({ id });
                    return generationInfo(id, 0);
                },
                async () => {},
            ),
            0,
        );
        assert.equal(polls, 1);
        assert.equal(attempts, 2);
    }
});
