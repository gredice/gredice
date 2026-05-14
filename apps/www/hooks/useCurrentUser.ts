'use client';

import { useQuery } from '@tanstack/react-query';

export type CurrentUser = {
    id: string;
    userName: string;
    displayName?: string;
    avatarUrl?: string | null;
};

async function fetchCurrentUser(): Promise<CurrentUser | null> {
    try {
        const response = await fetch('/api/gredice/api/auth/current-claims', {
            cache: 'no-store',
        });
        if (response.ok) {
            return (await response.json()) as CurrentUser;
        }
        return null;
    } catch {
        return null;
    }
}

export function useCurrentUser() {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: fetchCurrentUser,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
}
