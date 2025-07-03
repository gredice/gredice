import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { client } from "@gredice/client";
import { currentGardenKeys } from "./useCurrentGarden";

export function useUpdateRaisedBed(gardenId: number, raisedBedId: number) {
    const queryClient = useQueryClient();
    const currentUser = useCurrentUser();
    return useMutation({
        mutationFn: async ({ name }: { name?: string | null }) => {
            if (!currentUser.data) {
                throw new Error('Current user data is not available');
            }

            const response = await client().api.gardens[":gardenId"]["raised-beds"][":raisedBedId"].$patch({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString()
                },
                json: {
                    name: name || undefined,
                }
            });
        },
        onError: (error) => {
            console.error('Failed to update raised bed:', error);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: currentGardenKeys });
        }
    })
}
