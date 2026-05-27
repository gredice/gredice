import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
            onChunk,
        }: {
            gardenId: number;
            raisedBedId: number;
            imageUrls: string[];
            onChunk?: (accumulated: string) => void;
        }) => {
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
                },
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(
                    message || 'Greška prilikom AI analize fotografije.',
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
                onChunk?.(markdown);
            }

            return { markdown };
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
