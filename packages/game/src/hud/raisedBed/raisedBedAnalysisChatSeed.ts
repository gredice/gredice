import { raisedBedAnalysisChatText } from '@gredice/js/ai';

export { getRaisedBedAnalysisConversationId } from '@gredice/js/ai';

import type { SuncokretChatSeed } from '../SuncokretChatProvider';
import type { SuncokretContextSuggestion } from '../suncokretChatContext';
import type { PhotoAnalysisAttachment } from './photoAnalysisChat';

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

/**
 * Turns a finished AI raised bed analysis into a new Suncokret thread that
 * opens with the analysis, so follow-up questions keep its context.
 */
export function buildRaisedBedAnalysisChatSeed({
    analysisMarkdown,
    analyzedAt,
    photoAnalysis,
    id,
    positionIndex,
    referenceDate,
}: {
    analysisMarkdown: string;
    analyzedAt?: Date | null;
    photoAnalysis?: PhotoAnalysisAttachment;
    id: string;
    positionIndex?: number;
    referenceDate?: Date | string | null;
}): SuncokretChatSeed {
    return {
        id,
        title: 'AI analiza fotografija',
        messages: [
            {
                role: 'assistant',
                photoAnalysis,
                createdAt:
                    analyzedAt && !Number.isNaN(analyzedAt.getTime())
                        ? analyzedAt.toISOString()
                        : undefined,
                text: raisedBedAnalysisChatText({
                    analysisMarkdown,
                    positionIndex,
                    referenceDate,
                }),
            },
        ],
        suggestions: raisedBedAnalysisSuggestions,
    };
}
