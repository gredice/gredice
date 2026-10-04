import { setTimeout as delay } from 'node:timers/promises';
import {
    AI_USD_TO_EUR_REFERENCE_RATE,
    convertAiUsdToEur,
} from '@gredice/js/ai';
import {
    type AiChatPricing,
    calculateAiChatUsageCostMicroEur,
} from '@gredice/storage';
import { createGateway, gateway } from 'ai';

type SuncokretLongContextPricing = {
    inputTokenThreshold: number;
    inputRateMultiplier: number;
    outputRateMultiplier: number;
};

export type SuncokretModelConfig = AiChatPricing & {
    id: string;
    label: string;
    enabled: boolean;
    longContext?: SuncokretLongContextPricing;
};

const DEFAULT_MODEL_ID = 'openai/gpt-6-luna';

type SuncokretModelUsdConfig = {
    id: string;
    label: string;
    enabled: boolean;
    inputUsdPerMillionTokens: number;
    outputUsdPerMillionTokens: number;
    cachedInputUsdPerMillionTokens?: number;
    cacheWriteInputUsdPerMillionTokens?: number;
    longContext?: SuncokretLongContextPricing;
};

// Used only when AI Gateway metadata cannot be loaded. Normal requests replace
// these values with Gateway catalog pricing and persist the billed request cost.
const MODEL_REGISTRY_USD: SuncokretModelUsdConfig[] = [
    {
        id: 'openai/gpt-6-luna',
        label: 'OpenAI GPT-6 Luna',
        inputUsdPerMillionTokens: 0.1,
        outputUsdPerMillionTokens: 0.5,
        cachedInputUsdPerMillionTokens: 0.01,
        cacheWriteInputUsdPerMillionTokens: 0.125,
        longContext: {
            inputTokenThreshold: 272_000,
            inputRateMultiplier: 2,
            outputRateMultiplier: 1.5,
        },
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
export const SUNCOKRET_GATEWAY_COST_LOOKUP_TIMEOUT_MS = 90_000;

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
        ...(model.longContext ? { longContext: model.longContext } : {}),
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
        ...(model.longContext ? { longContext: model.longContext } : {}),
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
    loadGeneration: (
        id: string,
        signal: AbortSignal,
    ) => Promise<GatewayGenerationInfo> = (id, signal) =>
        createGateway({
            fetch: (url, init) =>
                fetch(url, {
                    ...init,
                    signal: init?.signal
                        ? AbortSignal.any([signal, init.signal])
                        : signal,
                }),
        }).getGenerationInfo({ id }),
    wait: (ms: number, signal: AbortSignal) => Promise<void> = (ms, signal) =>
        delay(ms, undefined, { signal }),
    timeoutMs = SUNCOKRET_GATEWAY_COST_LOOKUP_TIMEOUT_MS,
) {
    const generationIds = suncokretGatewayGenerationIds(steps);
    if (generationIds.length === 0) {
        return null;
    }

    // Gateway ingests usage asynchronously. Retry only the documented not-yet
    // response, including the SDK's GatewayResponseError wrapper from production.
    // One deadline covers all generations, network calls and backoff waits.
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort(new Error('Suncokret Gateway cost lookup timed out'));
    }, timeoutMs);
    const { signal } = controller;
    // Keep the fast initial polls, then allow ingestion beyond the old seven
    // second window. This runs in waitUntil, with the quota reservation held.
    const retryDelays = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000];
    const aborted = new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
        });
    });
    try {
        const lookups = Promise.all(
            generationIds.map(async (id) => {
                for (let attempt = 0; ; attempt++) {
                    try {
                        return await loadGeneration(id, signal);
                    } catch (error) {
                        const retryDelay = retryDelays[attempt];
                        if (
                            signal.aborted ||
                            retryDelay === undefined ||
                            !isGatewayUsageNotYetAvailable(error)
                        ) {
                            throw error;
                        }
                        await wait(retryDelay, signal);
                    }
                }
            }),
        );
        const generations = await Promise.race([lookups, aborted]);
        if (
            generations.some(
                (generation, index) =>
                    generation.id !== generationIds[index] ||
                    !Number.isFinite(generation.totalCost) ||
                    generation.totalCost < 0,
            )
        ) {
            return null;
        }
        const totalCostUsd = generations.reduce(
            (sum, generation) => sum + generation.totalCost,
            0,
        );

        return Number.isFinite(totalCostUsd)
            ? Math.round(usdToEur(totalCostUsd) * EUR_TO_MICRO_EUR)
            : null;
    } finally {
        clearTimeout(timeout);
        // Stop other pending generations if one lookup failed permanently.
        controller.abort();
    }
}

function isGatewayUsageNotYetAvailable(error: unknown) {
    if (
        typeof error !== 'object' ||
        error === null ||
        !('statusCode' in error) ||
        error.statusCode !== 404
    ) {
        return false;
    }
    // Structured errors become GatewayNotFoundError (without a response field).
    if ('message' in error && error.message === 'Usage event not found') {
        return true;
    }
    if (!('response' in error)) return false;
    const response = error.response;
    if (
        typeof response !== 'object' ||
        response === null ||
        !('error' in response)
    ) {
        return false;
    }
    return (
        response.error === 'Usage event not found' ||
        (typeof response.error === 'object' &&
            response.error !== null &&
            'message' in response.error &&
            response.error.message === 'Usage event not found')
    );
}

export function estimateSuncokretPromptTokens(value: unknown) {
    return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

// Requests above the long-context threshold are billed at higher rates for
// the whole request, so budgeting and fallback usage costs must use them too.
export function suncokretPricingForInputTokens(
    model: SuncokretModelConfig,
    inputTokens: number,
): AiChatPricing {
    const longContext = model.longContext;
    if (!longContext || inputTokens <= longContext.inputTokenThreshold) {
        return model;
    }

    const { inputRateMultiplier, outputRateMultiplier } = longContext;
    return {
        inputEurPerMillionTokens:
            model.inputEurPerMillionTokens * inputRateMultiplier,
        outputEurPerMillionTokens:
            model.outputEurPerMillionTokens * outputRateMultiplier,
        ...(model.cachedInputEurPerMillionTokens == null
            ? {}
            : {
                  cachedInputEurPerMillionTokens:
                      model.cachedInputEurPerMillionTokens *
                      inputRateMultiplier,
              }),
        ...(model.cacheWriteInputEurPerMillionTokens == null
            ? {}
            : {
                  cacheWriteInputEurPerMillionTokens:
                      model.cacheWriteInputEurPerMillionTokens *
                      inputRateMultiplier,
              }),
    };
}

// Gateway applies the long-context threshold per model call, so the largest
// step decides the rate tier rather than the summed usage of all tool steps.
export function largestSuncokretStepInputTokens(
    steps: readonly { usage?: { inputTokens?: number | undefined } }[],
) {
    return steps.reduce(
        (largest, step) => Math.max(largest, step.usage?.inputTokens ?? 0),
        0,
    );
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
        pricing: suncokretPricingForInputTokens(model, inputTokens),
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
    const pricing = suncokretPricingForInputTokens(model, estimatedInputTokens);
    const inputCost = calculateAiChatUsageCostMicroEur({
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        pricing,
    }).inputMicroEur;
    const remainingForOutput = remainingMicroEur - inputCost;
    if (remainingForOutput <= 0) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            2048,
            Math.floor(remainingForOutput / pricing.outputEurPerMillionTokens),
        ),
    );
}
