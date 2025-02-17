import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

export const currentGardenKeys = ['gardens', 'current'];

export function useCurrentGarden() {
    return useQuery({
        queryKey: currentGardenKeys,
        queryFn: async () => {
            const response = await client().api.gardens.$get();
            const gardens = await response.json();
            const currentGardenId = gardens[0].id;
            const currentGardenResponse = await client().api.gardens[":gardenId"].$get({
                param: {
                    gardenId: currentGardenId.toString()
                }
            });
            if (currentGardenResponse.status !== 200) {
                throw new Error('Failed to fetch current garden');
            }
            return await currentGardenResponse.json();
        }
    });
}
