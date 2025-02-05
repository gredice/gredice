import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../utils/apiFetch";

async function getCurrentUser() {
    const response = await apiFetch('/api/users/current');
    if (response.status < 200 || response.status > 299) {
        return null;
    }

    const currentUser = await response.json() as {
        id: string;
        userName: string;
        displayName: string;
        createdAt: string;
    };
    return {
        ...currentUser,
        displayName: currentUser.displayName || currentUser.userName,
        createdAt: new Date(currentUser.createdAt),
    };
}

export function useCurrentUser() {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
    });
}
