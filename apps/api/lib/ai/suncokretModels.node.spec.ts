import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getSuncokretGatewayBilledCostMicroUsd,
    getSuncokretModel,
    getSuncokretPricedModel,
    suncokretGatewayGenerationIds,
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
    },
    callback: () => void,
) {
    const previousDefault = process.env.SUNCOKRET_AI_DEFAULT_MODEL;
    const previousAllowlist = process.env.SUNCOKRET_AI_MODEL_ALLOWLIST;

    setEnvValue('SUNCOKRET_AI_DEFAULT_MODEL', env.defaultModel);
    setEnvValue('SUNCOKRET_AI_MODEL_ALLOWLIST', env.allowlist);

    try {
        callback();
    } finally {
        setEnvValue('SUNCOKRET_AI_DEFAULT_MODEL', previousDefault);
        setEnvValue('SUNCOKRET_AI_MODEL_ALLOWLIST', previousAllowlist);
    }
}

test('getSuncokretModel defaults to DeepSeek V4 Flash', () => {
    withModelEnv({}, () => {
        assert.equal(getSuncokretModel()?.id, 'deepseek/deepseek-v4-flash');
    });
});

test('getSuncokretModel falls back to the first enabled model for automatic selection', () => {
    withModelEnv(
        {
            allowlist: 'openai/gpt-5.6-luna',
        },
        () => {
            const model = getSuncokretModel();

            assert.equal(model?.id, 'openai/gpt-5.6-luna');
            assert.equal(model?.inputUsdPerMillionTokens, 0.2);
            assert.equal(model?.outputUsdPerMillionTokens, 1.2);
        },
    );
});

test('getSuncokretModel keeps explicit unavailable model requests invalid', () => {
    withModelEnv(
        {
            allowlist: 'openai/gpt-5.6-luna',
        },
        () => {
            assert.equal(getSuncokretModel('deepseek/deepseek-v4-flash'), null);
        },
    );
});

test('getSuncokretPricedModel uses current AI Gateway catalog pricing', async () => {
    await withModelEnvAsync(
        {
            allowlist: 'openai/gpt-5.6-luna',
        },
        async () => {
            const model = await getSuncokretPricedModel(
                'openai/gpt-5.6-luna',
                async () => ({
                    models: [
                        {
                            id: 'openai/gpt-5.6-luna',
                            name: 'GPT 5.6 Luna',
                            pricing: {
                                input: '0.00000015',
                                output: '0.0000009',
                                cachedInputTokens: '0.000000015',
                                cacheCreationInputTokens: '0.00000019',
                            },
                            specification: {
                                specificationVersion: 'v4',
                                provider: 'gateway',
                                modelId: 'openai/gpt-5.6-luna',
                            },
                            modelType: 'language',
                        },
                    ],
                }),
            );

            assert.equal(model?.inputUsdPerMillionTokens, 0.15);
            assert.equal(model?.outputUsdPerMillionTokens, 0.9);
            assert.equal(model?.cachedInputUsdPerMillionTokens, 0.015);
            assert.equal(model?.cacheWriteInputUsdPerMillionTokens, 0.19);
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
        await getSuncokretGatewayBilledCostMicroUsd(steps, async (id) => ({
            id,
            totalCost: id === 'gen_one' ? 0.0123451 : 0.0000001,
            upstreamInferenceCost: 0,
            usage: 0,
            createdAt: '2026-08-05T00:00:00.000Z',
            model: 'openai/gpt-5.6-luna',
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
        12_345,
    );
});

async function withModelEnvAsync(
    env: {
        defaultModel?: string;
        allowlist?: string;
    },
    callback: () => Promise<void>,
) {
    const previousDefault = process.env.SUNCOKRET_AI_DEFAULT_MODEL;
    const previousAllowlist = process.env.SUNCOKRET_AI_MODEL_ALLOWLIST;

    setEnvValue('SUNCOKRET_AI_DEFAULT_MODEL', env.defaultModel);
    setEnvValue('SUNCOKRET_AI_MODEL_ALLOWLIST', env.allowlist);

    try {
        await callback();
    } finally {
        setEnvValue('SUNCOKRET_AI_DEFAULT_MODEL', previousDefault);
        setEnvValue('SUNCOKRET_AI_MODEL_ALLOWLIST', previousAllowlist);
    }
}
