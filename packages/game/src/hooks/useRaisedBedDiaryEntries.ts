import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const queryKeys = {
    byId: (raisedBedId: number) => ['raisedBeds', raisedBedId, 'diary'],
};

export function useRaisedBedDiaryEntries(
    gardenId: number,
    raisedBedId: number,
) {
    return useQuery({
        queryKey: queryKeys.byId(raisedBedId),
        queryFn: async () => {
            const entries = await client().api.gardens[':gardenId'][
                'raised-beds'
            ][':raisedBedId']['diary-entries'].$get({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
            });
            if (entries.status === 400) {
                console.error(
                    'Failed to fetch diary entries - bad request',
                    entries,
                );
                return [];
            }
            if (entries.status === 404) {
                console.error(
                    'Raised bed not found or no diary entries available',
                    entries,
                );
                return [];
            }
            return (await entries.json()).map((entry) => ({
                ...entry,
                timestamp: new Date(entry.timestamp),
            }));
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: Boolean(gardenId) && Boolean(raisedBedId),
    });
}
