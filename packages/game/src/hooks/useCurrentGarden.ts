import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

const gardensKeys = ['gardens'];

function useGardens() {
    return useQuery({
        queryKey: gardensKeys,
        queryFn: async () => await client().api.gardens.$get().then((response) => response.json())
    });
}

export const currentGardenKeys = ['gardens', 'current'];

export function useCurrentGarden() {
    const { data: gardens } = useGardens();
    return useQuery({
        queryKey: currentGardenKeys,
        queryFn: async () => {
            if (!gardens || gardens.length <= 0) {
                throw new Error('No gardens found');
            }

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
        },
        enabled: Boolean(gardens)
    });
}
