import { clientPublic } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const whatsNewEntriesQueryKey = ['whatsNewEntries'];
export const whatsNewEntryQueryKey = ['whatsNewEntry'];
export const whatsNewEntriesAudienceTag = 'Korisnici';

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
                tag: whatsNewEntriesAudienceTag,
            },
        ],
        queryFn: async () => {
            const response = await clientPublic().api.news.changelog.$get({
                query: {
                    limit: limit.toString(),
                    since: since?.toISOString(),
                    tag: whatsNewEntriesAudienceTag,
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

export function useWhatsNewEntry({
    enabled = true,
    slug,
}: {
    enabled?: boolean;
    slug?: string | null;
}) {
    return useQuery({
        queryKey: [...whatsNewEntryQueryKey, slug ?? null],
        queryFn: async () => {
            if (!slug) {
                throw new Error('What is new entry slug is required');
            }

            const response = await clientPublic().api.news.changelog[
                ':slug{.+}'
            ].$get({
                param: { slug },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch what is new entry');
            }

            const entry = await response.json();
            return {
                ...entry,
                publishedAt: entry.publishedAt
                    ? new Date(entry.publishedAt)
                    : null,
                updatedAt: new Date(entry.updatedAt),
            };
        },
        staleTime: 1000 * 60 * 5,
        enabled: enabled && Boolean(slug),
    });
}
