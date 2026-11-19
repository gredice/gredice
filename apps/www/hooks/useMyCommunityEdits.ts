'use client';

import { clientAuthenticated } from '@gredice/client';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export const myCommunityEditsQueryKey = ['myCommunityEdits'];

/** Reads one page; `before` is the previous page's `nextCursor`. */
async function fetchMyCommunityEdits(before?: number) {
    const response = await clientAuthenticated().api.directories[
        'community-edits'
    ].mine.$get({
        query: before === undefined ? {} : { before: before.toString() },
    });
    if (!response.ok) {
        throw new Error('Učitavanje prijedloga nije uspjelo.');
    }

    return response.json();
}

export type MyCommunityEdits = Awaited<
    ReturnType<typeof fetchMyCommunityEdits>
>;
export type MyCommunityEdit = MyCommunityEdits['items'][number];

/**
 * The signed-in visitor's newest suggestions and accepted count. Disabled
 * while signed out.
 */
export function useMyCommunityEdits() {
    const { data: user } = useCurrentUser();

    return useQuery({
        queryKey: [...myCommunityEditsQueryKey, user?.id ?? null],
        queryFn: () => fetchMyCommunityEdits(),
        enabled: Boolean(user),
        retry: false,
        staleTime: 60 * 1000,
    });
}

function newestPageCursor(): number | null {
    return null;
}

/**
 * The signed-in visitor's whole suggestion history, read page by page from
 * the newest. Disabled while signed out.
 */
export function useMyCommunityEditHistory() {
    const { data: user } = useCurrentUser();

    return useInfiniteQuery({
        queryKey: [...myCommunityEditsQueryKey, 'history', user?.id ?? null],
        queryFn: ({ pageParam }) =>
            fetchMyCommunityEdits(pageParam ?? undefined),
        initialPageParam: newestPageCursor(),
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: Boolean(user),
        retry: false,
        staleTime: 60 * 1000,
    });
}
