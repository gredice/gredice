import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const queryKeys = {
    byId: (raisedBedId: number) => ['raisedBeds', raisedBedId, 'ai-history'],
};

export function useRaisedBedAiHistory(
    gardenId: number,
    raisedBedId: number,
    options: { enabled?: boolean } = {},
) {
    return useQuery({
        queryKey: queryKeys.byId(raisedBedId),
        queryFn: async () => {
            const entries = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-beds'][':raisedBedId']['ai-history'].$get({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
            });
            if (entries.status === 400) {
                console.error(
                    'Failed to fetch AI history entries - bad request',
                    entries,
                );
                return [];
            }
            if (entries.status === 404) {
                console.error(
                    'Raised bed not found or no AI history available',
                    entries,
                );
                return [];
            }
            return (await entries.json()).map((entry) => ({
                ...entry,
                timestamp: new Date(entry.timestamp),
            }));
        },
        staleTime: 5 * 60 * 1000,
        enabled:
            (options.enabled ?? true) &&
            Boolean(gardenId) &&
            Boolean(raisedBedId),
    });
}
