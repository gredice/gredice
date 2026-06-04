import { clientPublic } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const whatsNewEntriesQueryKey = ['whatsNewEntries'];

export function useWhatsNewEntries({
    enabled = true,
    limit = 5,
    since,
}: {
    enabled?: boolean;
    limit?: number;
    since?: Date | null;
} = {}) {
    return useQuery({
        queryKey: [
            ...whatsNewEntriesQueryKey,
            {
                limit,
                since: since?.toISOString() ?? null,
            },
        ],
        queryFn: async () => {
            const response = await clientPublic().api.news.changelog.$get({
                query: {
                    limit: limit.toString(),
                    since: since?.toISOString(),
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch what is new entries');
            }

            const body = await response.json();
            return body.items.map((entry) => ({
                ...entry,
                publishedAt: entry.publishedAt
                    ? new Date(entry.publishedAt)
                    : null,
                updatedAt: new Date(entry.updatedAt),
            }));
        },
        staleTime: 1000 * 60 * 5,
        enabled,
    });
}
