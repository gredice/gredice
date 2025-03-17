import { client } from "@gredice/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { currentGardenKeys, useCurrentGarden } from "./useCurrentGarden";

export function useBlockRotate() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    return useMutation({
        mutationFn: async ({ blockId, rotation }: { blockId: string, rotation: number }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            await client().api.gardens[":gardenId"].blocks[":blockId"].$put({
                param: {
                    gardenId,
                    blockId: blockId
                },
                json: {
                    rotation: rotation
                }
            });

            // TODO: Do optimistic local update
        },
        onSettled: async () => {
            // Invalidate queries
            await queryClient.invalidateQueries({ queryKey: currentGardenKeys });
        }
    })
}
