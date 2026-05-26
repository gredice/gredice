type AiAnalysisUsage = {
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
};

type AiAnalysisEvent = {
    data?: AiAnalysisUsage | null;
};

type AiModelPricing = {
    inputUsdPerMillionTokens: number;
    outputUsdPerMillionTokens: number;
    longContext?: {
        inputTokenThreshold: number;
        inputRateMultiplier: number;
        outputRateMultiplier: number;
    };
};

const TOKENS_PER_MILLION = 1_000_000;

const AI_MODEL_PRICING_USD: Record<string, AiModelPricing> = {
    'gpt-5.5': {
        inputUsdPerMillionTokens: 5,
        outputUsdPerMillionTokens: 30,
        longContext: {
            inputTokenThreshold: 272_000,
            inputRateMultiplier: 2,
            outputRateMultiplier: 1.5,
        },
    },
    'gpt-5.4': {
        inputUsdPerMillionTokens: 2.5,
        outputUsdPerMillionTokens: 15,
    },
    'gpt-5.4-mini': {
        inputUsdPerMillionTokens: 0.75,
        outputUsdPerMillionTokens: 4.5,
    },
};

function normalizedOpenAiModel(model?: string | null) {
    const value = model?.trim().toLowerCase();
    if (!value) return null;
    return value.startsWith('openai/') ? value.slice('openai/'.length) : value;
}

function finiteTokenCount(value: number | null | undefined) {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, value)
        : 0;
}

export function estimateAiAnalysisCostUsd(usage?: AiAnalysisUsage | null) {
    const model = normalizedOpenAiModel(usage?.model);
    if (!model) return null;

    const pricing = AI_MODEL_PRICING_USD[model];
    if (!pricing) return null;

    const inputTokens = finiteTokenCount(usage?.inputTokens);
    const outputTokens = finiteTokenCount(usage?.outputTokens);
    const longContext =
        pricing.longContext &&
        inputTokens > pricing.longContext.inputTokenThreshold
            ? pricing.longContext
            : null;

    const inputRate =
        pricing.inputUsdPerMillionTokens *
        (longContext?.inputRateMultiplier ?? 1);
    const outputRate =
        pricing.outputUsdPerMillionTokens *
        (longContext?.outputRateMultiplier ?? 1);

    return (
        (inputTokens / TOKENS_PER_MILLION) * inputRate +
        (outputTokens / TOKENS_PER_MILLION) * outputRate
    );
}

export function sumAiAnalysisCostUsd(events: AiAnalysisEvent[]) {
    return events.reduce(
        (sum, event) => sum + (estimateAiAnalysisCostUsd(event.data) ?? 0),
        0,
    );
}

export function formatAiCostUsd(value: number | null | undefined) {
    if (value == null) return '-';

    return new Intl.NumberFormat('hr-HR', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
    }).format(value);
}
