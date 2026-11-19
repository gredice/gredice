'use client';

import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export const myCommunityEditsQueryKey = ['myCommunityEdits'];

async function fetchMyCommunityEdits() {
    const response =
        await clientAuthenticated().api.directories[
            'community-edits'
        ].mine.$get();
    if (!response.ok) {
        throw new Error('Učitavanje prijedloga nije uspjelo.');
    }

    return response.json();
}

export type MyCommunityEdits = Awaited<
    ReturnType<typeof fetchMyCommunityEdits>
>;
export type MyCommunityEdit = MyCommunityEdits['items'][number];

/** The signed-in visitor's own suggestions. Disabled while signed out. */
export function useMyCommunityEdits() {
    const { data: user } = useCurrentUser();

    return useQuery({
        queryKey: [...myCommunityEditsQueryKey, user?.id ?? null],
        queryFn: fetchMyCommunityEdits,
        enabled: Boolean(user),
        retry: false,
        staleTime: 60 * 1000,
    });
}
