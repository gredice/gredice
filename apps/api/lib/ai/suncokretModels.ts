import {
    type AiChatPricing,
    calculateAiChatUsageCostMicroUsd,
} from '@gredice/storage';

export type SuncokretModelConfig = AiChatPricing & {
    id: string;
    label: string;
    enabled: boolean;
};

const DEFAULT_MODEL_ID = 'deepseek/deepseek-v4-flash';

const MODEL_REGISTRY: SuncokretModelConfig[] = [
    {
        id: 'openai/gpt-5.6-luna',
        label: 'OpenAI GPT-5.6 Luna',
        inputUsdPerMillionTokens: 1,
        outputUsdPerMillionTokens: 6,
        enabled: true,
    },
    {
        id: 'deepseek/deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        inputUsdPerMillionTokens: 0.14,
        outputUsdPerMillionTokens: 0.28,
        enabled: true,
    },
];

function envModelAllowlist() {
    return (process.env.SUNCOKRET_AI_MODEL_ALLOWLIST ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

export function getSuncokretModelRegistry() {
    const allowlist = envModelAllowlist();
    if (allowlist.length === 0) {
        return MODEL_REGISTRY;
    }

    const allowed = new Set(allowlist);
    return MODEL_REGISTRY.map((model) => ({
        ...model,
        enabled: model.enabled && allowed.has(model.id),
    }));
}

export function getSuncokretModel(modelId?: string | null) {
    const requestedModelId = modelId?.trim();
    const registry = getSuncokretModelRegistry();

    if (requestedModelId) {
        return (
            registry.find(
                (model) => model.id === requestedModelId && model.enabled,
            ) ?? null
        );
    }

    const defaultModelId =
        process.env.SUNCOKRET_AI_DEFAULT_MODEL || DEFAULT_MODEL_ID;
    return (
        registry.find(
            (model) => model.id === defaultModelId && model.enabled,
        ) ??
        registry.find((model) => model.enabled) ??
        null
    );
}

export function estimateSuncokretPromptTokens(value: unknown) {
    return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

export function estimateSuncokretRequestCostMicroUsd({
    inputTokens,
    maxOutputTokens,
    model,
}: {
    inputTokens: number;
    maxOutputTokens: number;
    model: SuncokretModelConfig;
}) {
    return calculateAiChatUsageCostMicroUsd({
        inputTokens,
        outputTokens: maxOutputTokens,
        pricing: model,
    }).totalMicroUsd;
}

export function resolveSuncokretMaxOutputTokens({
    estimatedInputTokens,
    model,
    remainingMicroUsd,
}: {
    estimatedInputTokens: number;
    model: SuncokretModelConfig;
    remainingMicroUsd: number;
}) {
    const inputCost = calculateAiChatUsageCostMicroUsd({
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        pricing: model,
    }).inputMicroUsd;
    const remainingForOutput = remainingMicroUsd - inputCost;
    if (remainingForOutput <= 0) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            2048,
            Math.floor(remainingForOutput / model.outputUsdPerMillionTokens),
        ),
    );
}
