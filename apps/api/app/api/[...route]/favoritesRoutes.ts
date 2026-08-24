import {
    FavoriteEntityNotFoundError,
    type FavoriteEntityType,
    favoriteEntityTypes,
    listUserFavorites,
    type SelectUserFavorite,
    setUserFavorite,
} from '@gredice/storage';
import { type Context, Hono, type MiddlewareHandler, type Next } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const favoriteQuerySchema = z
    .object({
        entityType: z.enum(favoriteEntityTypes).optional(),
    })
    .strict();

const favoriteSetSchema = z
    .object({
        entityType: z.enum(favoriteEntityTypes),
        entityId: z.number().int().positive(),
        favorited: z.boolean(),
    })
    .strict();

type FavoriteAuthValidator = (
    roles: string[],
) => MiddlewareHandler<{ Variables: AuthVariables }>;

export type FavoriteRouteDeps = {
    authValidator: FavoriteAuthValidator;
    listUserFavorites: typeof listUserFavorites;
    setUserFavorite: typeof setUserFavorite;
};

function serializeFavorite(favorite: SelectUserFavorite) {
    return {
        id: favorite.id,
        entityType: favorite.entityType,
        entityId: favorite.entityId,
        createdAt: favorite.createdAt.toISOString(),
        updatedAt: favorite.updatedAt.toISOString(),
    };
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
}

const defaultDeps: FavoriteRouteDeps = {
    authValidator,
    listUserFavorites,
    setUserFavorite,
};

export function createFavoritesRoutes(deps: FavoriteRouteDeps = defaultDeps) {
    return new Hono<{ Variables: AuthVariables }>()
        .get(
            '/',
            describeRoute({
                description:
                    'List the current authenticated user favorites for plants, plant sorts, and operations.',
                security: authSecurity,
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('query', favoriteQuerySchema),
            async (context) => {
                const { entityType } = context.req.valid('query');
                const { userId } = context.get('authContext');
                const favorites = await deps.listUserFavorites({
                    userId,
                    entityType,
                });

                return context.json(
                    {
                        favorites: favorites.map(serializeFavorite),
                    },
                    200,
                );
            },
        )
        .put(
            '/',
            describeRoute({
                description:
                    'Set the favorite state for a plant, plant sort, or operation for the current authenticated user.',
                security: authSecurity,
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('json', favoriteSetSchema),
            async (context) => {
                const { entityId, entityType, favorited } =
                    context.req.valid('json');
                const { userId } = context.get('authContext');

                try {
                    const result = await deps.setUserFavorite({
                        userId,
                        entityType,
                        entityId,
                        favorited,
                    });

                    return context.json(
                        {
                            favorited: result.favorited,
                            favorite: result.favorite
                                ? serializeFavorite(result.favorite)
                                : null,
                        },
                        200,
                    );
                } catch (error) {
                    if (error instanceof FavoriteEntityNotFoundError) {
                        return context.json(
                            { error: errorMessage(error) },
                            404,
                        );
                    }

                    throw error;
                }
            },
        );
}

export function createTestAuthMiddleware({
    accountId = 'test-account',
    userId = 'test-user',
}: {
    accountId?: string;
    userId?: string;
} = {}) {
    return async (
        context: Context<{ Variables: AuthVariables }>,
        next: Next,
    ) => {
        context.set('authContext', {
            accountId,
            userId,
            user: {
                id: userId,
                accountIds: [accountId],
                isTemporary: false,
                role: 'user',
            },
        });

        await next();
    };
}

export type FavoriteRouteEntityType = FavoriteEntityType;

export default createFavoritesRoutes();
