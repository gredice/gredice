import { useQuery } from "@tanstack/react-query";
import { client } from "@gredice/client";

export const queryKey = {
    currentUser: ['currentUser'],
};

async function getCurrentUser() {
    const response = await client().api.users.current.$get();
    if (response.status === 404) {
        console.error('User not found');
        return null;
    }

    const currentUser = await response.json();
    return {
        ...currentUser,
        createdAt: new Date(currentUser.createdAt),
    };
}

export function useCurrentUser() {
    return useQuery({
        queryKey: queryKey.currentUser,
        queryFn: getCurrentUser,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
