import { useQuery } from "@tanstack/react-query";
import { client } from "@gredice/client";

export const queryKey = {
    userLogins: (userId: string | null | undefined) => ['user', userId, 'logins'],
};

async function getUserLogins(userId: string) {
    const response = await client().api.users[":userId"].logins.$get({
        param: {
            userId
        }
    });
    if (response.status === 404) {
        console.error('User not found');
        return null;
    }

    const logins = await response.json();
    return {
        methods: logins.methods.map((login) => ({
            ...login,
            lastLogin: login.lastLogin ? new Date(login.lastLogin) : null,
        }))
    };
}

export function useUserLogins(userId: string | null | undefined) {
    return useQuery({
        queryKey: queryKey.userLogins(userId),
        queryFn: async () => await getUserLogins(userId!),
        staleTime: 1000 * 60 * 60, // 1 hour
        enabled: Boolean(userId), // Only run the query if userId is not null or undefined
    });
}
