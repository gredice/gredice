import assert from 'node:assert/strict';
import test from 'node:test';
import {
    FavoriteEntityNotFoundError,
    type SelectUserFavorite,
} from '@gredice/storage';
import {
    createFavoritesRoutes,
    createTestAuthMiddleware,
    type FavoriteRouteDeps,
} from '../../app/api/[...route]/favoritesRoutes';

function favorite({
    entityId,
    entityType,
    id = entityId,
}: {
    entityId: number;
    entityType: SelectUserFavorite['entityType'];
    id?: number;
}): SelectUserFavorite {
    return {
        id,
        userId: 'test-user',
        entityType,
        entityId,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    };
}

function jsonRequest(body: unknown) {
    return {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'PUT',
    };
}

test('favorites route lists current-user favorites with optional entity type filter', async () => {
    const calls: Array<{ userId: string; entityType?: string }> = [];
    const deps: FavoriteRouteDeps = {
        authValidator: () => createTestAuthMiddleware(),
        listUserFavorites: async (input) => {
            calls.push(input);
            const favorites = [
                favorite({ entityId: 10, entityType: 'plant' }),
                favorite({ entityId: 20, entityType: 'operation' }),
            ];
            return input.entityType
                ? favorites.filter(
                      (item) => item.entityType === input.entityType,
                  )
                : favorites;
        },
        setUserFavorite: async (input) => ({
            favorited: input.favorited,
            favorite: input.favorited
                ? favorite({
                      entityId: input.entityId,
                      entityType: input.entityType,
                  })
                : null,
        }),
    };
    const app = createFavoritesRoutes(deps);

    const response = await app.request('/?entityType=operation');
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
        {
            userId: 'test-user',
            entityType: 'operation',
        },
    ]);
    assert.deepEqual(await response.json(), {
        favorites: [
            {
                id: 20,
                entityType: 'operation',
                entityId: 20,
                createdAt: '2026-06-01T00:00:00.000Z',
                updatedAt: '2026-06-01T00:00:00.000Z',
            },
        ],
    });
});

test('favorites route sets and unsets favorite state for the current user', async () => {
    const inputs: unknown[] = [];
    const deps: FavoriteRouteDeps = {
        authValidator: () => createTestAuthMiddleware(),
        listUserFavorites: async () => [],
        setUserFavorite: async (input) => {
            inputs.push(input);
            return {
                favorited: input.favorited,
                favorite: input.favorited
                    ? favorite({
                          entityId: input.entityId,
                          entityType: input.entityType,
                      })
                    : null,
            };
        },
    };
    const app = createFavoritesRoutes(deps);

    const added = await app.request(
        '/',
        jsonRequest({
            entityType: 'plantSort',
            entityId: 123,
            favorited: true,
        }),
    );
    assert.equal(added.status, 200);
    assert.deepEqual(await added.json(), {
        favorited: true,
        favorite: {
            id: 123,
            entityType: 'plantSort',
            entityId: 123,
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
        },
    });

    const removed = await app.request(
        '/',
        jsonRequest({
            entityType: 'plantSort',
            entityId: 123,
            favorited: false,
        }),
    );
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), {
        favorited: false,
        favorite: null,
    });
    assert.deepEqual(inputs, [
        {
            userId: 'test-user',
            entityType: 'plantSort',
            entityId: 123,
            favorited: true,
        },
        {
            userId: 'test-user',
            entityType: 'plantSort',
            entityId: 123,
            favorited: false,
        },
    ]);
});

test('favorites route rejects invalid entity types and maps missing targets to 404', async () => {
    const deps: FavoriteRouteDeps = {
        authValidator: () => createTestAuthMiddleware(),
        listUserFavorites: async () => [],
        setUserFavorite: async () => {
            throw new FavoriteEntityNotFoundError('plant', 999);
        },
    };
    const app = createFavoritesRoutes(deps);

    const invalidType = await app.request(
        '/',
        jsonRequest({
            entityType: 'block',
            entityId: 123,
            favorited: true,
        }),
    );
    assert.equal(invalidType.status, 400);

    const notFound = await app.request(
        '/',
        jsonRequest({
            entityType: 'plant',
            entityId: 999,
            favorited: true,
        }),
    );
    assert.equal(notFound.status, 404);
    assert.deepEqual(await notFound.json(), {
        error: 'Favorite target was not found: plant:999',
    });
});
