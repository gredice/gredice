import { clientAuthenticated } from './hono';

export type FavoriteEntityType = 'plant' | 'plantSort' | 'operation';

export type FavoriteItem = {
    id: number;
    entityType: FavoriteEntityType;
    entityId: number;
    createdAt: string;
    updatedAt: string;
};

export type SetFavoriteInput = {
    entityType: FavoriteEntityType;
    entityId: number;
    favorited: boolean;
};

export async function listFavorites(
    entityType?: FavoriteEntityType,
): Promise<FavoriteItem[]> {
    const response = entityType
        ? await clientAuthenticated().api.favorites.$get({
              query: { entityType },
          })
        : await clientAuthenticated().api.favorites.$get({ query: {} });

    if (!response.ok) {
        throw new Error('Failed to fetch favorites');
    }

    return (await response.json()).favorites;
}

export async function setFavorite(input: SetFavoriteInput) {
    const response = await clientAuthenticated().api.favorites.$put({
        json: input,
    });

    if (response.status === 404) {
        throw new Error('Favorite target was not found');
    }

    if (!response.ok) {
        throw new Error('Failed to update favorite');
    }

    return await response.json();
}
