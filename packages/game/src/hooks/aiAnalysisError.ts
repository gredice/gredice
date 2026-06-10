const fallbackAiAnalysisErrorMessage =
    'Suncokret trenutno ne može dovršiti analizu. Pokušaj ponovno malo kasnije.';
const genericAiAnalysisErrorMessage =
    'Analiza nije uspjela. Pokušaj ponovno kasnije.';

export class AiAnalysisRequestError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = 'AiAnalysisRequestError';
    }
}

function getStringProperty(value: unknown, key: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const candidate: unknown = Reflect.get(value, key);

    return typeof candidate === 'string' && candidate.trim()
        ? candidate.trim()
        : null;
}

function getJsonErrorMessage(text: string) {
    try {
        const parsed: unknown = JSON.parse(text);

        if (typeof parsed === 'string' && parsed.trim()) {
            return parsed.trim();
        }

        return (
            getStringProperty(parsed, 'error') ??
            getStringProperty(parsed, 'message')
        );
    } catch {
        return null;
    }
}

export async function getAiAnalysisErrorMessage(response: Response) {
    const text = (await response.text()).trim();

    if (!text) {
        return fallbackAiAnalysisErrorMessage;
    }

    const jsonErrorMessage = getJsonErrorMessage(text);
    if (jsonErrorMessage) {
        return jsonErrorMessage;
    }

    if (response.status === 429) {
        return 'Iskoristili ste tjedni limit AI savjeta. Pokušaj ponovno kasnije.';
    }

    if (response.status >= 500) {
        return fallbackAiAnalysisErrorMessage;
    }

    if (text.startsWith('{') || text.startsWith('[')) {
        return genericAiAnalysisErrorMessage;
    }

    return text;
}
