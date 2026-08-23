export const actorSpeechDurationMs = 5_000;

export const catSpeechMessages = ['Mijau!', 'Prrr...', 'Mjau-mjau!'] as const;

export const dogSpeechMessages = ['Vau!', 'Av-av!', 'Hov-hov!'] as const;

export const chickenSpeechMessages = [
    'Kokoda!',
    'Ko-ko-ko!',
    'Kluk-kluk!',
] as const;

export const pigletSpeechMessages = [
    'Grok-grok!',
    'Kvik-kvik!',
    'Njušk-njušk!',
] as const;

export const goatSpeechMessages = ['Mee-e!', 'Meee!', 'Njom-njom!'] as const;

export const birdSpeechMessages = [
    'Cvrk-cvrk!',
    'Ćiju-ći!',
    'Piju-piju!',
] as const;

export const beeSpeechMessages = ['Bzzz!', 'Zum-zum!', 'Bzz-bzz!'] as const;

export const squirrelSpeechMessages = [
    'Cik-cik!',
    'Njušk-njušk!',
    'Šuš-šuš!',
] as const;

export const playerSpeechMessages = [
    'Baš je lijep dan u vrtu!',
    'Vrt danas izgleda prekrasno.',
    'Divan dan za šetnju vrtom.',
    'Danas sve u vrtu lijepo raste!',
    'Kakav ugodan dan u vrtu!',
] as const;

export function pickActorSpeechMessage({
    messages,
    previousMessage,
    random = Math.random,
}: {
    messages: readonly string[];
    previousMessage?: string | null;
    random?: () => number;
}) {
    if (messages.length === 0) {
        return null;
    }

    const availableMessages =
        messages.length > 1 && previousMessage
            ? messages.filter((message) => message !== previousMessage)
            : messages;
    const randomIndex = Math.min(
        Math.floor(Math.max(0, random()) * availableMessages.length),
        availableMessages.length - 1,
    );

    return availableMessages[randomIndex] ?? null;
}
