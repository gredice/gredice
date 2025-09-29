import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export type OperationStatusCode =
    | 'new'
    | 'planned'
    | 'completed'
    | 'failed'
    | 'canceled';

export type RaisedBedDiaryEntry = {
    id: number;
    kind?: 'raisedBed' | 'raisedBedField' | 'operation';
    name: string;
    description?: string;
    status: string | null;
    statusCode?: OperationStatusCode | null;
    timestamp: Date;
    imageUrls?: string[] | null;
    scheduledDate?: Date | null;
};

export const queryKeys = {
    byId: (raisedBedId: number) => ['raisedBeds', raisedBedId, 'diary'],
};

export function useRaisedBedDiaryEntries(
    gardenId: number,
    raisedBedId: number,
) {
    return useQuery<RaisedBedDiaryEntry[]>({
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
            const data = (await entries.json()) as Array<{
                id: number;
                kind?: 'raisedBed' | 'raisedBedField' | 'operation';
                name: string;
                description?: string;
                status: string | null;
                statusCode?: OperationStatusCode | null;
                timestamp: string;
                imageUrls?: string[] | null;
                scheduledDate?: string | null;
            }>;
            return data.map((entry) => ({
                ...entry,
                statusCode: entry.statusCode ?? null,
                scheduledDate: entry.scheduledDate
                    ? new Date(entry.scheduledDate)
                    : null,
                timestamp: new Date(entry.timestamp),
            }));
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: Boolean(gardenId) && Boolean(raisedBedId),
    });
}
