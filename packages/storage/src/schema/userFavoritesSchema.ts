import { relations } from 'drizzle-orm';
import {
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { entities } from './cmsSchema';
import { users } from './usersSchema';

export const userFavoriteEntityTypeEnum = pgEnum('user_favorite_entity_type', [
    'plant',
    'plantSort',
    'operation',
]);

export const favoriteEntityTypes = userFavoriteEntityTypeEnum.enumValues;
export type FavoriteEntityType = (typeof favoriteEntityTypes)[number];

export const userFavorites = pgTable(
    'user_favorites',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        entityType: userFavoriteEntityTypeEnum('entity_type').notNull(),
        entityId: integer('entity_id')
            .notNull()
            .references(() => entities.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('user_favorites_user_entity_uq').on(
            table.userId,
            table.entityType,
            table.entityId,
        ),
        index('user_favorites_user_id_idx').on(table.userId),
        index('user_favorites_entity_type_idx').on(table.entityType),
        index('user_favorites_entity_id_idx').on(table.entityId),
    ],
);

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
    user: one(users, {
        fields: [userFavorites.userId],
        references: [users.id],
        relationName: 'userFavorites',
    }),
    entity: one(entities, {
        fields: [userFavorites.entityId],
        references: [entities.id],
        relationName: 'entityFavorites',
    }),
}));

export type SelectUserFavorite = typeof userFavorites.$inferSelect;
