import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'raisedBedFieldUpdateStatus'];

export function useRaisedBedFieldUpdateStatus() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            raisedBedId,
            positionIndex,
            status,
            timestamp,
        }: {
            raisedBedId: number;
            positionIndex: number;
            status: string;
            timestamp?: string;
        }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            const raisedBed = garden.raisedBeds.find(
                (bed) => bed.id === raisedBedId,
            );
            if (!raisedBed) {
                throw new Error('Raised bed not found');
            }

            const field = raisedBed.fields.find(
                (field) =>
                    field.positionIndex === positionIndex && field.active,
            );
            if (!field) {
                throw new Error('Field not found');
            }

            const response = await client().api.gardens[':gardenId'][
                'raised-beds'
            ][':raisedBedId'].fields[':positionIndex'].$patch({
                param: {
                    gardenId: garden.id.toString(),
                    raisedBedId: raisedBedId.toString(),
                    positionIndex: positionIndex.toString(),
                },
                json: {
                    status,
                    timestamp,
                },
            });

            if (response.status !== 200) {
                const errorData = await response.text();
                throw new Error(`Failed to update plant status: ${errorData}`);
            }
        },
        onMutate: async ({ raisedBedId, positionIndex, status }) => {
            if (!garden) {
                return;
            }

            const updatedRaisedBeds = garden.raisedBeds.map((raisedBed) => {
                if (raisedBed.id === raisedBedId) {
                    return {
                        ...raisedBed,
                        fields: raisedBed.fields.map((field) => {
                            if (
                                field.positionIndex === positionIndex &&
                                field.active
                            ) {
                                return {
                                    ...field,
                                    plantStatus: status,
                                };
                            }
                            return field;
                        }),
                    };
                }
                return raisedBed;
            });

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    ...garden,
                    raisedBeds: updatedRaisedBeds,
                },
            );

            return {
                previousItem,
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error updating plant field status:', error);
            if (context?.previousItem) {
                queryClient.setQueryData(gardenQueryKey, context.previousItem);
            }
        },
        onSettled: async () => {
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
