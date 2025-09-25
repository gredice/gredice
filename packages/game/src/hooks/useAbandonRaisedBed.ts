import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'raisedBedAbandon'];

export function useAbandonRaisedBed(gardenId: number, raisedBedId: number) {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();

    return useMutation({
        mutationKey,
        mutationFn: async () => {
            await client().api.gardens[':gardenId']['raised-beds'][
                ':raisedBedId'
            ].$delete({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
            });
        },
        onMutate: async () => {
            if (!garden) {
                return;
            }

            const targetRaisedBed = garden.raisedBeds.find(
                (bed) => bed.id === raisedBedId,
            );
            const updatedRaisedBeds = garden.raisedBeds.filter(
                (bed) => bed.id !== raisedBedId,
            );
            const updatedStacks = targetRaisedBed?.blockId
                ? garden.stacks.map((stack) => {
                      const blocks = stack.blocks.filter(
                          (block) => block.id !== targetRaisedBed.blockId,
                      );
                      if (blocks.length === stack.blocks.length) {
                          return stack;
                      }
                      return {
                          ...stack,
                          blocks,
                      };
                  })
                : garden.stacks;

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                currentGardenKeys,
                {
                    raisedBeds: updatedRaisedBeds,
                    stacks: updatedStacks,
                },
            );

            return { previousItem };
        },
        onError: (error, _variables, context) => {
            console.error('Failed to abandon raised bed:', error);
            if (context?.previousItem) {
                queryClient.setQueryData(
                    currentGardenKeys,
                    context.previousItem,
                );
            }
        },
        onSettled: async () => {
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: currentGardenKeys,
                });
            }
        },
    });
}
