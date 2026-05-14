import {
    index,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './usersSchema';

export const refreshTokens = pgTable(
    'refresh_tokens',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id),
        tokenHash: text('token_hash').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
        expiresAt: timestamp('expires_at').notNull(),
    },
    (table) => [
        index('refresh_tokens_user_id_idx').on(table.userId),
        index('refresh_tokens_expires_at_idx').on(table.expiresAt),
        // Unique index on tokenHash prevents hash collisions and enables efficient lookups
        uniqueIndex('refresh_tokens_token_hash_idx').on(table.tokenHash),
    ],
);

export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
export type SelectRefreshToken = typeof refreshTokens.$inferSelect;
