import {
    AI_USD_TO_EUR_REFERENCE_RATE,
    convertAiUsdToEur,
} from '@gredice/js/ai';
import {
    type AiChatPricing,
    calculateAiChatUsageCostMicroEur,
} from '@gredice/storage';
import { gateway } from 'ai';

export type SuncokretModelConfig = AiChatPricing & {
    id: string;
    label: string;
    enabled: boolean;
};

const DEFAULT_MODEL_ID = 'openai/gpt-5.6-luna';

type SuncokretModelUsdConfig = {
    id: string;
    label: string;
    enabled: boolean;
    inputUsdPerMillionTokens: number;
    outputUsdPerMillionTokens: number;
    cachedInputUsdPerMillionTokens?: number;
    cacheWriteInputUsdPerMillionTokens?: number;
};

// Used only when AI Gateway metadata cannot be loaded. Normal requests replace
// these values with Gateway catalog pricing and persist the billed request cost.
const MODEL_REGISTRY_USD: SuncokretModelUsdConfig[] = [
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
const EUR_TO_MICRO_EUR = 1_000_000;

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

export function getSuncokretUsdToEurRate() {
    const configured = Number(process.env.SUNCOKRET_AI_USD_TO_EUR_RATE);
    return Number.isFinite(configured) && configured > 0
        ? configured
        : AI_USD_TO_EUR_REFERENCE_RATE;
}

function usdToEur(value: number) {
    return Number(
        convertAiUsdToEur(value, getSuncokretUsdToEurRate()).toPrecision(12),
    );
}

function usdModelPricingToEur(
    model: SuncokretModelUsdConfig,
): SuncokretModelConfig {
    return {
        id: model.id,
        label: model.label,
        enabled: model.enabled,
        inputEurPerMillionTokens: usdToEur(model.inputUsdPerMillionTokens),
        outputEurPerMillionTokens: usdToEur(model.outputUsdPerMillionTokens),
        ...(model.cachedInputUsdPerMillionTokens == null
            ? {}
            : {
                  cachedInputEurPerMillionTokens: usdToEur(
                      model.cachedInputUsdPerMillionTokens,
                  ),
              }),
        ...(model.cacheWriteInputUsdPerMillionTokens == null
            ? {}
            : {
                  cacheWriteInputEurPerMillionTokens: usdToEur(
                      model.cacheWriteInputUsdPerMillionTokens,
                  ),
              }),
    };
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
        inputEurPerMillionTokens: usdToEur(inputUsdPerMillionTokens),
        outputEurPerMillionTokens: usdToEur(outputUsdPerMillionTokens),
        ...(cachedInputUsdPerMillionTokens === null
            ? {}
            : {
                  cachedInputEurPerMillionTokens: usdToEur(
                      cachedInputUsdPerMillionTokens,
                  ),
              }),
        ...(cacheWriteInputUsdPerMillionTokens === null
            ? {}
            : {
                  cacheWriteInputEurPerMillionTokens: usdToEur(
                      cacheWriteInputUsdPerMillionTokens,
                  ),
              }),
    };
}

function envModelAllowlist() {
    return (process.env.SUNCOKRET_AI_MODEL_ALLOWLIST ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

export function getSuncokretModelRegistry() {
    const registry = MODEL_REGISTRY_USD.map(usdModelPricingToEur);
    const allowlist = envModelAllowlist();
    if (allowlist.length === 0) {
        return registry;
    }

    const allowed = new Set(allowlist);
    return registry.map((model) => ({
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

export async function getSuncokretGatewayBilledCostMicroEur(
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
        ? Math.round(usdToEur(totalCostUsd) * EUR_TO_MICRO_EUR)
        : null;
}

export function estimateSuncokretPromptTokens(value: unknown) {
    return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

export function estimateSuncokretRequestCostMicroEur({
    inputTokens,
    maxOutputTokens,
    model,
}: {
    inputTokens: number;
    maxOutputTokens: number;
    model: SuncokretModelConfig;
}) {
    return calculateAiChatUsageCostMicroEur({
        inputTokens,
        outputTokens: maxOutputTokens,
        pricing: model,
    }).totalMicroEur;
}

export function resolveSuncokretMaxOutputTokens({
    estimatedInputTokens,
    model,
    remainingMicroEur,
}: {
    estimatedInputTokens: number;
    model: SuncokretModelConfig;
    remainingMicroEur: number;
}) {
    const inputCost = calculateAiChatUsageCostMicroEur({
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        pricing: model,
    }).inputMicroEur;
    const remainingForOutput = remainingMicroEur - inputCost;
    if (remainingForOutput <= 0) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            2048,
            Math.floor(remainingForOutput / model.outputEurPerMillionTokens),
        ),
    );
}
