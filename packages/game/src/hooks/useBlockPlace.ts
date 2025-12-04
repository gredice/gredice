import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { useGameState } from '../useGameState';
import { currentAccountKeys } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockPlace'];

export function useBlockPlace() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const isWinterMode = useGameState((state) => state.isWinterMode);
    const gardenQueryKey = currentGardenKeys(isWinterMode);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            blockName,
            position,
        }: {
            blockName: string;
            position: [x: number, y: number];
        }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            // Generate block
            const response = await client().api.gardens[
                ':gardenId'
            ].blocks.$post({
                param: {
                    gardenId: garden?.id.toString(),
                },
                json: {
                    blockName: blockName,
                },
            });
            if (response.status !== 200) {
                const body = await response.text();
                // TODO: Display error message (insuficient funds, etc)
                throw new Error(`Failed to create block: ${body}`);
            }
            const { id } = await response.json();

            // Place block
            await client().api.gardens[':gardenId'].stacks.$patch({
                param: {
                    gardenId: garden?.id.toString(),
                },
                json: [
                    {
                        op: 'add',
                        path: `/${position[0]}/${position[1]}/-`,
                        value: id,
                    },
                ],
            });

            return id;
        },
        onMutate: async ({ blockName, position }) => {
            if (!garden) {
                return;
            }

            const newBlock = { id: uuidv4(), name: blockName, rotation: 0 };
            const stack = garden.stacks.find(
                (stack) =>
                    stack.position.x === position[0] &&
                    stack.position.z === position[1],
            );
            const updatedStacks = stack
                ? garden.stacks.map((stack) => {
                      if (
                          stack.position.x === position[0] &&
                          stack.position.z === position[1]
                      ) {
                          return {
                              ...stack,
                              blocks: [...stack.blocks, newBlock],
                          };
                      }
                      return stack;
                  })
                : [
                      ...garden.stacks,
                      {
                          position: new Vector3(position[0], 0, position[1]),
                          blocks: [newBlock],
                      },
                  ];

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    stacks: [...updatedStacks],
                },
            );

            return {
                previousItem,
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error creating block', error);
            if (context?.previousItem) {
                queryClient.setQueryData(gardenQueryKey, context.previousItem);
            }
        },
        onSettled: async () => {
            // Invalidate queries
            await queryClient.invalidateQueries({
                queryKey: currentAccountKeys,
            });
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
