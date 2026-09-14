import {
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accounts, users } from './usersSchema';

export const deliveryNativeAuthorizationGrants = pgTable(
    'delivery_native_authorization_grants',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id, { onDelete: 'cascade' }),
        clientId: text('client_id').notNull(),
        redirectUri: text('redirect_uri').notNull(),
        codeChallenge: text('code_challenge').notNull(),
        codeChallengeMethod: text('code_challenge_method').notNull(),
        codeHash: text('code_hash').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        expiresAt: timestamp('expires_at').notNull(),
        usedAt: timestamp('used_at'),
        revokedAt: timestamp('revoked_at'),
    },
    (table) => [
        uniqueIndex('delivery_native_grants_code_hash_idx').on(table.codeHash),
        index('delivery_native_grants_user_id_idx').on(table.userId),
        index('delivery_native_grants_expires_at_idx').on(table.expiresAt),
    ],
);

export const deliveryNativeSessionFamilies = pgTable(
    'delivery_native_session_families',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id, { onDelete: 'cascade' }),
        clientId: text('client_id').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
        expiresAt: timestamp('expires_at').notNull(),
        revokedAt: timestamp('revoked_at'),
        revocationReason: text('revocation_reason'),
    },
    (table) => [
        index('delivery_native_session_families_user_id_idx').on(table.userId),
        index('delivery_native_session_families_expires_at_idx').on(
            table.expiresAt,
        ),
    ],
);

export const deliveryNativeRefreshTokens = pgTable(
    'delivery_native_refresh_tokens',
    {
        id: text('id').primaryKey(),
        sessionFamilyId: text('session_family_id')
            .notNull()
            .references(() => deliveryNativeSessionFamilies.id, {
                onDelete: 'cascade',
            }),
        tokenHash: text('token_hash').notNull(),
        generation: integer('generation').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        expiresAt: timestamp('expires_at').notNull(),
        consumedAt: timestamp('consumed_at'),
        replacedByTokenId: text('replaced_by_token_id'),
    },
    (table) => [
        uniqueIndex('delivery_native_refresh_tokens_hash_idx').on(
            table.tokenHash,
        ),
        index('delivery_native_refresh_tokens_family_id_idx').on(
            table.sessionFamilyId,
        ),
        index('delivery_native_refresh_tokens_expires_at_idx').on(
            table.expiresAt,
        ),
    ],
);

export type SelectDeliveryNativeAuthorizationGrant =
    typeof deliveryNativeAuthorizationGrants.$inferSelect;
export type SelectDeliveryNativeSessionFamily =
    typeof deliveryNativeSessionFamilies.$inferSelect;
export type SelectDeliveryNativeRefreshToken =
    typeof deliveryNativeRefreshTokens.$inferSelect;
