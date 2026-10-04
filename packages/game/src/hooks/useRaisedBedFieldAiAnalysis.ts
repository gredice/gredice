import { client } from '@gredice/client';
import { sanitizeRaisedBedAiMarkdown } from '@gredice/js/ai';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    AiAnalysisRequestError,
    getAiAnalysisErrorMessage,
} from './aiAnalysisError';
import { serializeAiAnalysisReferenceDate } from './aiAnalysisReferenceDate';
import { queryKeys as raisedBedAiHistoryQueryKeys } from './useRaisedBedAiHistory';
import { queryKeys as raisedBedFieldDiaryQueryKeys } from './useRaisedBedFieldDiaryEntries';

const mutationKey = ['gardens', 'current', 'raisedBedFieldAiAnalysis'];

export function useRaisedBedFieldAiAnalysis() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey,
        mutationFn: async ({
            gardenId,
            raisedBedId,
            positionIndex,
            imageUrls,
            referenceDate,
            onChunk,
        }: {
            gardenId: number;
            raisedBedId: number;
            positionIndex: number;
            imageUrls: string[];
            referenceDate?: Date | string | null;
            onChunk?: (accumulated: string) => void;
        }) => {
            const serializedReferenceDate =
                serializeAiAnalysisReferenceDate(referenceDate);
            const response = await client({
                auth: 'authenticated',
            }).api.gardens[':gardenId']['raised-beds'][':raisedBedId'].fields[
                ':positionIndex'
            ]['analyze-image'].$post({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                    positionIndex: positionIndex.toString(),
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
                    queryKey: raisedBedFieldDiaryQueryKeys.byId(
                        variables.raisedBedId,
                        variables.positionIndex,
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
