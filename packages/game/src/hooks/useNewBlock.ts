import { client } from "@gredice/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { currentGardenKeys, useCurrentGarden } from "./useCurrentGarden";
import { currentAccountKeys } from "./useCurrentAccount";

export function useNewBlock() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    return useMutation({
        mutationFn: async ({ blockName, position }: { blockName: string, position: [x: number, y: number] }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            // Generate block
            const response = await client.api.gardens[":gardenId"].blocks.$post({
                param: {
                    gardenId: garden?.id.toString()
                },
                json: {
                    blockName: blockName
                }
            });
            if (response.status !== 200) {
                const body = await response.json();
                throw new Error(`Failed to create block: ${body}`);
            }
            const { id } = await response.json();

            // Place block
            await client.api.gardens[":gardenId"].stacks.$patch({
                param: {
                    gardenId: garden?.id.toString()
                },
                json: [
                    { op: 'add', path: `/${position[0]}/${position[1]}/-`, value: id }
                ]
            });

            return id;
        },
        onSuccess: async () => {
            // Invalidate queries
            await queryClient.invalidateQueries({ queryKey: currentAccountKeys });
            await queryClient.invalidateQueries({ queryKey: currentGardenKeys });
        }
    })
}