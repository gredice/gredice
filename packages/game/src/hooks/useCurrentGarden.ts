import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

export function useCurrentGarden() {
    return useQuery({
        queryKey: ['gardens', 'current'],
        queryFn: async () => {
            const response = await client.api.gardens.$get({}, {
                headers: {
                    authorization: `Bearer ${localStorage.getItem('gredice-token')}`
                }
            });
            const gardens = await response.json();
            return gardens[0];
        }
    });
}
