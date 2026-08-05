import {
    type AiChatPricing,
    calculateAiChatUsageCostMicroUsd,
} from '@gredice/storage';
import { gateway } from 'ai';

export type SuncokretModelConfig = AiChatPricing & {
    id: string;
    label: string;
    enabled: boolean;
};

const DEFAULT_MODEL_ID = 'openai/gpt-5.6-luna';

// Used only when AI Gateway metadata cannot be loaded. Normal requests replace
// these values with Gateway catalog pricing and persist the billed request cost.
const MODEL_REGISTRY: SuncokretModelConfig[] = [
    {
        id: 'openai/gpt-5.6-luna',
        label: 'OpenAI GPT-5.6 Luna',
        inputUsdPerMillionTokens: 0.2,
        outputUsdPerMillionTokens: 1.2,
        cachedInputUsdPerMillionTokens: 0.02,
        cacheWriteInputUsdPerMillionTokens: 0.25,
        enabled: true,
    },
    {
        id: 'deepseek/deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        inputUsdPerMillionTokens: 0.2,
        outputUsdPerMillionTokens: 0.4,
        cachedInputUsdPerMillionTokens: 0.04,
        enabled: true,
    },
];

const USD_PER_TOKEN_TO_USD_PER_MILLION = 1_000_000;
const USD_TO_MICRO_USD = 1_000_000;

type GatewayModelMetadata = Awaited<
    ReturnType<typeof gateway.getAvailableModels>
>;

type GatewayGenerationInfo = Awaited<
    ReturnType<typeof gateway.getGenerationInfo>
>;

type SuncokretGatewayStep = {
    providerMetadata?: {
        gateway?: {
            generationId?: unknown;
        };
    };
};

function usdPerTokenToUsdPerMillion(value: string | undefined) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Number((parsed * USD_PER_TOKEN_TO_USD_PER_MILLION).toPrecision(12))
        : null;
}

function gatewayPricing(
    model: SuncokretModelConfig,
    metadata: GatewayModelMetadata,
) {
    const pricing = metadata.models.find(
        (candidate) => candidate.id === model.id,
    )?.pricing;
    const inputUsdPerMillionTokens = usdPerTokenToUsdPerMillion(pricing?.input);
    const outputUsdPerMillionTokens = usdPerTokenToUsdPerMillion(
        pricing?.output,
    );

    if (
        inputUsdPerMillionTokens === null ||
        outputUsdPerMillionTokens === null
    ) {
        return null;
    }

    const cachedInputUsdPerMillionTokens = usdPerTokenToUsdPerMillion(
        pricing?.cachedInputTokens,
    );
    const cacheWriteInputUsdPerMillionTokens = usdPerTokenToUsdPerMillion(
        pricing?.cacheCreationInputTokens,
    );

    return {
        id: model.id,
        label: model.label,
        enabled: model.enabled,
        inputUsdPerMillionTokens,
        outputUsdPerMillionTokens,
        ...(cachedInputUsdPerMillionTokens === null
            ? {}
            : { cachedInputUsdPerMillionTokens }),
        ...(cacheWriteInputUsdPerMillionTokens === null
            ? {}
            : { cacheWriteInputUsdPerMillionTokens }),
    };
}

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

export async function getSuncokretPricedModel(
    modelId?: string | null,
    loadModels: () => Promise<GatewayModelMetadata> = () =>
        gateway.getAvailableModels(),
) {
    const model = getSuncokretModel(modelId);
    if (!model) {
        return null;
    }

    try {
        const resolved = gatewayPricing(model, await loadModels());
        if (resolved) {
            return resolved;
        }

        console.warn(
            'Suncokret AI Gateway model pricing is unavailable; using fallback pricing',
            { modelId: model.id },
        );
    } catch (error) {
        console.warn(
            'Suncokret AI Gateway pricing lookup failed; using fallback pricing',
            { modelId: model.id, error },
        );
    }

    return model;
}

export function suncokretGatewayGenerationIds(
    steps: readonly SuncokretGatewayStep[],
) {
    return Array.from(
        new Set(
            steps.flatMap((step) => {
                const generationId =
                    step.providerMetadata?.gateway?.generationId;
                return typeof generationId === 'string' && generationId
                    ? [generationId]
                    : [];
            }),
        ),
    );
}

export async function getSuncokretGatewayBilledCostMicroUsd(
    steps: readonly SuncokretGatewayStep[],
    loadGeneration: (id: string) => Promise<GatewayGenerationInfo> = (id) =>
        gateway.getGenerationInfo({ id }),
) {
    const generationIds = suncokretGatewayGenerationIds(steps);
    if (generationIds.length === 0) {
        return null;
    }

    const generations = await Promise.all(generationIds.map(loadGeneration));
    const totalCostUsd = generations.reduce(
        (sum, generation) => sum + generation.totalCost,
        0,
    );

    return Number.isFinite(totalCostUsd) && totalCostUsd >= 0
        ? Math.round(totalCostUsd * USD_TO_MICRO_USD)
        : null;
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
