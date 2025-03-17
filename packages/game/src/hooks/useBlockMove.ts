import { client } from "@gredice/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { currentGardenKeys, useCurrentGarden } from "./useCurrentGarden";

export function useBlockMove() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    return useMutation({
        mutationFn: async ({ sourcePosition, destinationPosition, blockIndex }: { sourcePosition: {x: number, z: number}, destinationPosition: {x: number, z: number}, blockIndex: number }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            await client().api.gardens[":gardenId"].stacks.$patch({
                param: {
                    gardenId: gardenId
                },
                json: [
                    {
                        op: 'move',
                        from: `/${sourcePosition.x}/${sourcePosition.z}/${blockIndex}`,
                        path: `/${destinationPosition.x}/${destinationPosition.z}/-`
                    }
                ]
            });

            // TODO: Do optimistic local update
        },
        onSettled: async () => {
            // Invalidate queries
            await queryClient.invalidateQueries({ queryKey: currentGardenKeys });
        }
    })
}
