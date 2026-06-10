import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { storage } from '..';
import {
    entities,
    type FavoriteEntityType,
    favoriteEntityTypes,
    type SelectUserFavorite,
    userFavorites,
} from '../schema';

export class InvalidFavoriteEntityTypeError extends Error {
    constructor(entityType: string) {
        super(`Unsupported favorite entity type: ${entityType}`);
        this.name = 'InvalidFavoriteEntityTypeError';
    }
}

export class FavoriteEntityNotFoundError extends Error {
    constructor(entityType: FavoriteEntityType, entityId: number) {
        super(`Favorite target was not found: ${entityType}:${entityId}`);
        this.name = 'FavoriteEntityNotFoundError';
    }
}

export type UserFavoriteInput = {
    userId: string;
    entityType: FavoriteEntityType;
    entityId: number;
};

export type UserFavoriteStateInput = UserFavoriteInput & {
    favorited: boolean;
};

export type UserFavoriteState = {
    favorited: boolean;
    favorite: SelectUserFavorite | null;
};

export function isFavoriteEntityType(
    value: unknown,
): value is FavoriteEntityType {
    return (
        typeof value === 'string' &&
        favoriteEntityTypes.some((entityType) => entityType === value)
    );
}

export function parseFavoriteEntityType(value: string): FavoriteEntityType {
    if (!isFavoriteEntityType(value)) {
        throw new InvalidFavoriteEntityTypeError(value);
    }

    return value;
}

async function ensureFavoriteTarget({
    entityId,
    entityType,
}: Pick<UserFavoriteInput, 'entityId' | 'entityType'>) {
    const entity = await storage().query.entities.findFirst({
        where: and(
            eq(entities.id, entityId),
            eq(entities.entityTypeName, entityType),
            eq(entities.isDeleted, false),
        ),
    });

    if (!entity) {
        throw new FavoriteEntityNotFoundError(entityType, entityId);
    }
}

export async function listUserFavorites({
    entityType,
    userId,
}: {
    userId: string;
    entityType?: FavoriteEntityType;
}): Promise<SelectUserFavorite[]> {
    const filters = [eq(userFavorites.userId, userId)];
    if (entityType) {
        filters.push(eq(userFavorites.entityType, entityType));
    }

    return storage().query.userFavorites.findMany({
        where: and(...filters),
        orderBy: [
            desc(userFavorites.updatedAt),
            desc(userFavorites.createdAt),
            desc(userFavorites.id),
        ],
    });
}

export async function setUserFavorite({
    entityId,
    entityType,
    favorited,
    userId,
}: UserFavoriteStateInput): Promise<UserFavoriteState> {
    if (!favorited) {
        await storage()
            .delete(userFavorites)
            .where(
                and(
                    eq(userFavorites.userId, userId),
                    eq(userFavorites.entityType, entityType),
                    eq(userFavorites.entityId, entityId),
                ),
            );

        return {
            favorited: false,
            favorite: null,
        };
    }

    await ensureFavoriteTarget({ entityId, entityType });

    const now = new Date();
    const [favorite] = await storage()
        .insert(userFavorites)
        .values({
            userId,
            entityType,
            entityId,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [
                userFavorites.userId,
                userFavorites.entityType,
                userFavorites.entityId,
            ],
            set: {
                updatedAt: now,
            },
        })
        .returning();

    if (!favorite) {
        throw new FavoriteEntityNotFoundError(entityType, entityId);
    }

    return {
        favorited: true,
        favorite,
    };
}
