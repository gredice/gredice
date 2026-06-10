import {
    type FavoriteEntityType,
    type FavoriteItem,
    listFavorites,
    type SetFavoriteInput,
    setFavorite,
} from '@gredice/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useCurrentUser } from './useCurrentUser';

export const favoritesQueryKey = ['favorites'];

function applyFavoriteState(
    favorites: FavoriteItem[] | undefined,
    input: SetFavoriteInput,
): FavoriteItem[] {
    const currentFavorites = favorites ?? [];
    const existing = currentFavorites.find(
        (favorite) =>
            favorite.entityType === input.entityType &&
            favorite.entityId === input.entityId,
    );

    if (!input.favorited) {
        return currentFavorites.filter(
            (favorite) =>
                favorite.entityType !== input.entityType ||
                favorite.entityId !== input.entityId,
        );
    }

    if (existing) {
        return currentFavorites;
    }

    const now = new Date().toISOString();
    return [
        {
            id: -Date.now(),
            entityType: input.entityType,
            entityId: input.entityId,
            createdAt: now,
            updatedAt: now,
        },
        ...currentFavorites,
    ];
}

export function sortFavoritesFirst<T extends { id: number }>(
    items: T[],
    favoriteIds: Set<number>,
) {
    return [...items].sort((left, right) => {
        const leftFavorite = favoriteIds.has(left.id) ? 1 : 0;
        const rightFavorite = favoriteIds.has(right.id) ? 1 : 0;

        return rightFavorite - leftFavorite;
    });
}

export function useFavorites(enabled = true) {
    const { data: currentUser } = useCurrentUser(enabled);

    return useQuery({
        queryKey: favoritesQueryKey,
        queryFn: () => listFavorites(),
        enabled: enabled && Boolean(currentUser),
        retry: false,
        staleTime: 1000 * 60 * 5,
    });
}

export function useFavoriteIds(entityType: FavoriteEntityType) {
    const { data: favorites } = useFavorites();

    return useMemo(
        () =>
            new Set(
                (favorites ?? [])
                    .filter((favorite) => favorite.entityType === entityType)
                    .map((favorite) => favorite.entityId),
            ),
        [entityType, favorites],
    );
}

export function useSetFavorite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: setFavorite,
        onMutate: async (input) => {
            await queryClient.cancelQueries({ queryKey: favoritesQueryKey });
            const previousFavorites =
                queryClient.getQueryData<FavoriteItem[]>(favoritesQueryKey);

            queryClient.setQueryData<FavoriteItem[]>(
                favoritesQueryKey,
                applyFavoriteState(previousFavorites, input),
            );

            return { previousFavorites };
        },
        onError: (_error, _input, context) => {
            queryClient.setQueryData(
                favoritesQueryKey,
                context?.previousFavorites,
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
        },
    });
}
