import { client } from "@gredice/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { currentGardenKeys, useCurrentGarden } from "./useCurrentGarden";
import { currentAccountKeys } from "./useCurrentAccount";
import { Vector3 } from "three";
import { v4 as uuidv4 } from 'uuid';

export function useNewBlock() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    return useMutation({
        mutationFn: async ({ blockName, position }: { blockName: string, position: [x: number, y: number] }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            // TODO: Place block optimistic placement with temporary ID
            // const tempId = uuidv4();
            // gamePlaceBlock(new Vector3(position[0], 0, position[1]), {
            //     id: tempId,
            //     name: blockName,
            //     rotation: 0
            // });

            // Generate block
            const response = await client().api.gardens[":gardenId"].blocks.$post({
                param: {
                    gardenId: garden?.id.toString()
                },
                json: {
                    blockName: blockName
                }
            });
            if (response.status !== 200) {
                const body = await response.text();
                // TODO: Display error message (insuficient funds, etc)
                throw new Error(`Failed to create block: ${body}`);
            }
            const { id } = await response.json();

            // Place block
            await client().api.gardens[":gardenId"].stacks.$patch({
                param: {
                    gardenId: garden?.id.toString()
                },
                json: [
                    { op: 'add', path: `/${position[0]}/${position[1]}/-`, value: id }
                ]
            });

            return id;
        },
        onError: (_error, _variables, id) => {
            // TODO: Rollback block optimistic update
        },
        onSettled: async () => {
            // Invalidate queries
            await queryClient.invalidateQueries({ queryKey: currentAccountKeys });
            await queryClient.invalidateQueries({ queryKey: currentGardenKeys });
        }
    })
}