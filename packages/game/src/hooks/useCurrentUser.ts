import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const queryKey = {
    currentUser: ['currentUser'],
};

async function getCurrentUser() {
    const response = await client(true).api.users.current.$get();
    if (response.status === 401) {
        return null;
    }
    if (response.status === 404) {
        console.error('User not found');
        return null;
    }

    if (!response.ok) {
        throw new Error('Failed to fetch current user');
    }

    const {
        createdAt,
        birthdayLastUpdatedAt,
        birthdayLastRewardAt,
        ...currentUser
    } = await response.json();
    return {
        ...currentUser,
        createdAt: new Date(createdAt),
        birthdayLastUpdatedAt: birthdayLastUpdatedAt
            ? new Date(birthdayLastUpdatedAt)
            : null,
        birthdayLastRewardAt: birthdayLastRewardAt
            ? new Date(birthdayLastRewardAt)
            : null,
    };
}

export function useCurrentUser() {
    return useQuery({
        queryKey: queryKey.currentUser,
        queryFn: getCurrentUser,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
