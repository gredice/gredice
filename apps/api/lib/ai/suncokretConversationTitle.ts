import { gateway, generateText } from 'ai';

const MAX_TITLE_LENGTH = 72;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function firstSuncokretUserQuestion(messages: unknown[]) {
    for (const message of messages) {
        if (!isRecord(message) || message.role !== 'user') {
            continue;
        }

        const parts = Array.isArray(message.parts) ? message.parts : [];
        const text = parts
            .flatMap((part) => {
                if (
                    !isRecord(part) ||
                    part.type !== 'text' ||
                    typeof part.text !== 'string'
                ) {
                    return [];
                }

                return part.text.trim();
            })
            .filter(Boolean)
            .join(' ')
            .trim();

        if (text) {
            return text;
        }
    }

    return null;
}

export function normalizeSuncokretConversationTitle(
    value: string,
    fallbackQuestion: string,
) {
    const normalized = value
        .replace(/^\s*(naslov|title)\s*:\s*/i, '')
        .replace(/^\s*["'„“”]+|["'„“”]+\s*$/g, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const fallback = fallbackQuestion.replace(/\s+/g, ' ').trim();
    const title = normalized || fallback || 'Novi razgovor';

    if (title.length <= MAX_TITLE_LENGTH) {
        return title;
    }

    return `${title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

export function fallbackSuncokretConversationTitle(messages: unknown[]) {
    const question = firstSuncokretUserQuestion(messages);
    return question ? normalizeSuncokretConversationTitle('', question) : null;
}

export async function generateSuncokretConversationTitle({
    messages,
    modelId,
}: {
    messages: unknown[];
    modelId: string;
}) {
    const question = firstSuncokretUserQuestion(messages);
    if (!question) {
        return null;
    }

    const result = await generateText({
        model: gateway(modelId),
        system: 'Napiši kratak, jasan naslov razgovora na hrvatskom jeziku. Vrati samo naslov, bez navodnika, dvotočke ili objašnjenja. Naslov mora opisivati temu prvog korisničkog pitanja.',
        prompt: question,
        maxOutputTokens: 32,
    });

    return normalizeSuncokretConversationTitle(result.text, question);
}
