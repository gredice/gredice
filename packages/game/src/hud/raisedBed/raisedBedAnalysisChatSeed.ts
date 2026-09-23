import type { SuncokretChatSeed } from '../SuncokretChatProvider';
import type { SuncokretContextSuggestion } from '../suncokretChatContext';

const raisedBedAnalysisSuggestions: SuncokretContextSuggestion[] = [
    {
        label: 'Objasni najvažniju preporuku',
        prompt: 'Objasni mi detaljnije najvažniju preporuku iz ove analize i zašto je važna.',
    },
    {
        label: 'Složi plan za ovaj tjedan',
        prompt: 'Složi mi plan radnji za ovu gredicu za ovaj tjedan na temelju ove analize.',
    },
    {
        label: 'Predloži radnje za naručiti',
        prompt: 'Koje radnje mogu naručiti da riješim probleme iz ove analize?',
    },
];

function formatAnalysisDate(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleDateString('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

/**
 * Turns a finished AI raised bed analysis into a new Suncokret thread that
 * opens with the analysis, so follow-up questions keep its context.
 */
export function buildRaisedBedAnalysisChatSeed({
    analysisMarkdown,
    analyzedAt,
    id,
    positionIndex,
    referenceDate,
}: {
    analysisMarkdown: string;
    analyzedAt?: Date | null;
    id: string;
    positionIndex?: number;
    referenceDate?: Date | string | null;
}): SuncokretChatSeed {
    const analysisDate = formatAnalysisDate(referenceDate);
    const scope =
        typeof positionIndex === 'number'
            ? `polja ${(positionIndex + 1).toString()}`
            : 'gredice';
    const intro = analysisDate
        ? `Evo moje analize fotografija ${scope} od ${analysisDate}:`
        : `Evo moje analize fotografija ${scope}:`;

    return {
        id,
        title: 'AI analiza fotografija',
        messages: [
            {
                role: 'assistant',
                createdAt:
                    analyzedAt && !Number.isNaN(analyzedAt.getTime())
                        ? analyzedAt.toISOString()
                        : undefined,
                text: `${intro}\n\n${analysisMarkdown}`,
            },
        ],
        suggestions: raisedBedAnalysisSuggestions,
    };
}

/** A saved analysis has one durable conversation per user; the API still enforces ownership. */
export function getRaisedBedAnalysisConversationId(
    analysisId: number,
    userId: string,
) {
    return `analysis-${analysisId}-${userId}`;
}
