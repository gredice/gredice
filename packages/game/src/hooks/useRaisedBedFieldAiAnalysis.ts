import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
            imageUrl,
        }: {
            gardenId: number;
            raisedBedId: number;
            positionIndex: number;
            imageUrl: string;
        }) => {
            const response = await client().api.gardens[':gardenId'][
                'raised-beds'
            ][':raisedBedId'].fields[':positionIndex']['analyze-image'].$post({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                    positionIndex: positionIndex.toString(),
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
                queryKey: raisedBedFieldDiaryQueryKeys.byId(
                    variables.raisedBedId,
                    variables.positionIndex,
                ),
            });
        },
    });
}
