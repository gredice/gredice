import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys as raisedBedDiaryQueryKeys } from './useRaisedBedDiaryEntries';

const mutationKey = ['gardens', 'current', 'raisedBedAiAnalysis'];

export function useRaisedBedAiAnalysis() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey,
        mutationFn: async ({
            gardenId,
            raisedBedId,
            imageUrl,
        }: {
            gardenId: number;
            raisedBedId: number;
            imageUrl: string;
        }) => {
            const response = await client().api.gardens[':gardenId'][
                'raised-beds'
            ][':raisedBedId']['analyze-image'].$post({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
                json: {
                    imageUrl,
                },
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(
                    message || 'Greška prilikom AI analize fotografije.',
                );
            }

            return response.json();
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: raisedBedDiaryQueryKeys.byId(variables.raisedBedId),
            });
        },
    });
}