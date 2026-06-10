'use client';

import { useQuery } from '@tanstack/react-query';

export type CurrentUser = {
    id: string;
    userName: string;
    displayName?: string;
    avatarUrl?: string | null;
};

async function fetchCurrentUser(
    apiBasePath: string,
): Promise<CurrentUser | null> {
    try {
        const response = await fetch(`${apiBasePath}/api/auth/current-claims`, {
            cache: 'no-store',
            credentials: 'include',
        });
        if (response.ok) {
            return (await response.json()) as CurrentUser;
        }
        return null;
    } catch {
        return null;
    }
}

export function useCurrentUser(apiBasePath = '/api/gredice') {
    return useQuery({
        queryKey: ['currentUser', apiBasePath],
        queryFn: () => fetchCurrentUser(apiBasePath),
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
}
