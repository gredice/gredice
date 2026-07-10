import assert from 'node:assert/strict';
import test from 'node:test';
import { getSuncokretModel } from './suncokretModels';

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
            assert.equal(model?.inputUsdPerMillionTokens, 1);
            assert.equal(model?.outputUsdPerMillionTokens, 6);
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
