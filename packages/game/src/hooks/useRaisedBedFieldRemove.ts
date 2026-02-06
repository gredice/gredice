import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'raisedBedFieldRemove'];

export function useRaisedBedFieldRemove() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            raisedBedId,
            positionIndex,
        }: {
            raisedBedId: number;
            positionIndex: number;
        }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            // Find the field to validate it can be removed
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

            // Check if the field is marked for removal (toBeRemoved)
            if (!field.toBeRemoved) {
                throw new Error(
                    'Plant cannot be removed at this time. Only plants that are dead, harvested, or failed to sprout can be removed.',
                );
            }

            // Call the backend API to update the plant status to 'removed'
            const response = await client().api.gardens[':gardenId'][
                'raised-beds'
            ][':raisedBedId'].fields[':positionIndex'].$patch({
                param: {
                    gardenId: garden.id.toString(),
                    raisedBedId: raisedBedId.toString(),
                    positionIndex: positionIndex.toString(),
                },
                json: {
                    status: 'removed',
                },
            });

            if (response.status !== 200) {
                const errorData = await response.text();
                throw new Error(`Failed to remove plant: ${errorData}`);
            }
        },
        onMutate: async ({ raisedBedId, positionIndex }) => {
            if (!garden) {
                return;
            }

            // Optimistically update the garden data
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
                                    plantStatus: 'removed',
                                    active: false,
                                    plantRemovedDate: new Date().toISOString(),
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
            console.error('Error removing plant from field:', error);
            if (context?.previousItem) {
                queryClient.setQueryData(gardenQueryKey, context.previousItem);
            }
        },
        onSettled: async () => {
            // Invalidate queries to refetch fresh data
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
