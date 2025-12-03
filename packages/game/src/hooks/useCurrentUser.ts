import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const queryKey = {
    currentUser: ['currentUser'],
};

type ApiRoutes = ReturnType<typeof client>;
type ApiCurrentUser = InferResponseType<
    ApiRoutes['api']['users']['current']['$get'],
    200
>;

export type CurrentUser = Omit<
    ApiCurrentUser,
    'createdAt' | 'birthdayLastUpdatedAt' | 'birthdayLastRewardAt'
> & {
    createdAt: Date;
    birthdayLastUpdatedAt: Date | null;
    birthdayLastRewardAt: Date | null;
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

    const currentUser: ApiCurrentUser = await response.json();
    return {
        ...currentUser,
        createdAt: new Date(currentUser.createdAt),
        birthdayLastUpdatedAt: currentUser.birthdayLastUpdatedAt
            ? new Date(currentUser.birthdayLastUpdatedAt)
            : null,
        birthdayLastRewardAt: currentUser.birthdayLastRewardAt
            ? new Date(currentUser.birthdayLastRewardAt)
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
