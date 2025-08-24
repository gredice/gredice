import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export function useRaisedBedSensors(gardenId: number, raisedBedId: number) {
    return useQuery({
        queryKey: ['raisedBeds', raisedBedId, 'sensors'],
        queryFn: async () => {
            const response = await client().api.gardens[':gardenId'][
                'raised-beds'
            ][':raisedBedId'].sensors.$get({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
            });
            if (response.status === 400) {
                console.error(
                    'Failed to fetch sensor data - bad request',
                    response,
                );
                return null;
            }
            if (response.status === 404) {
                console.error(
                    'Raised bed not found or no sensors available',
                    response,
                );
                return [];
            }
            return await response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: Boolean(gardenId) && Boolean(raisedBedId),
    });
}
