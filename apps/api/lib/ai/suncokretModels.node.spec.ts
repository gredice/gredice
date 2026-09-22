import assert from 'node:assert/strict';
import test from 'node:test';
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
