import { clientAuthenticated } from '@gredice/client';
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
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

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

            const createBlock = async () => {
                const response = await clientAuthenticated().api.gardens[
                    ':gardenId'
                ].blocks.$post({
                    param: {
                        gardenId: garden.id.toString(),
                    },
                    json: {
                        blockName: blockName,
                    },
                });
                if (response.status !== 200) {
                    const body = await response.text();
                    throw new Error(`Failed to create block: ${body}`);
                }
                const { id } = await response.json();
                return id;
            };

            const primaryBlockId = await createBlock();

            await clientAuthenticated().api.gardens[':gardenId'].stacks.$patch({
                param: {
                    gardenId: garden.id.toString(),
                },
                json: [
                    {
                        op: 'add',
                        path: `/${position[0]}/${position[1]}/-`,
                        value: primaryBlockId,
                    },
                ],
            });

            return [primaryBlockId];
        },
        onMutate: async ({ blockName, position }) => {
            if (!garden) {
                return;
            }

            const primaryBlock = { id: uuidv4(), name: blockName, rotation: 0 };
            const nextStacks = [...garden.stacks];

            const ensureStack = (coordinates: [number, number]) => {
                const existingStack = nextStacks.find(
                    (candidate) =>
                        candidate.position.x === coordinates[0] &&
                        candidate.position.z === coordinates[1],
                );
                if (existingStack) {
                    return existingStack;
                }

                const createdStack = {
                    position: new Vector3(coordinates[0], 0, coordinates[1]),
                    blocks: [] as (typeof primaryBlock)[],
                };
                nextStacks.push(createdStack);
                return createdStack;
            };

            ensureStack(position).blocks.push(primaryBlock);

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    stacks: [...nextStacks],
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
