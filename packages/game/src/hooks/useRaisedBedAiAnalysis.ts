import { client } from '@gredice/client';
import { sanitizeRaisedBedAiMarkdown } from '@gredice/js/ai';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    AiAnalysisRequestError,
    getAiAnalysisErrorMessage,
} from './aiAnalysisError';
import { serializeAiAnalysisReferenceDate } from './aiAnalysisReferenceDate';
import { queryKeys as raisedBedAiHistoryQueryKeys } from './useRaisedBedAiHistory';
import { queryKeys as raisedBedDiaryQueryKeys } from './useRaisedBedDiaryEntries';

const mutationKey = ['gardens', 'current', 'raisedBedAiAnalysis'];

export function useRaisedBedAiAnalysis() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey,
        mutationFn: async ({
            gardenId,
            raisedBedId,
            imageUrls,
            referenceDate,
            onChunk,
        }: {
            gardenId: number;
            raisedBedId: number;
            imageUrls: string[];
            referenceDate?: Date | string | null;
            onChunk?: (accumulated: string) => void;
        }) => {
            const serializedReferenceDate =
                serializeAiAnalysisReferenceDate(referenceDate);
            const response = await client({
                auth: 'authenticated',
            }).api.gardens[':gardenId']['raised-beds'][':raisedBedId'][
                'analyze-image'
            ].$post({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
                json: {
                    imageUrls,
                    ...(serializedReferenceDate
                        ? { referenceDate: serializedReferenceDate }
                        : {}),
                },
            });

            if (!response.ok) {
                throw new AiAnalysisRequestError(
                    await getAiAnalysisErrorMessage(response),
                    response.status,
                );
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response stream available.');
            }

            const decoder = new TextDecoder();
            let markdown = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                markdown += decoder.decode(value, { stream: true });
                onChunk?.(sanitizeRaisedBedAiMarkdown(markdown));
            }

            return { markdown: sanitizeRaisedBedAiMarkdown(markdown) };
        },
        onSuccess: async (_data, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: raisedBedDiaryQueryKeys.byId(
                        variables.raisedBedId,
                    ),
                }),
                queryClient.invalidateQueries({
                    queryKey: raisedBedAiHistoryQueryKeys.byId(
                        variables.raisedBedId,
                    ),
                }),
            ]);
        },
    });
}
