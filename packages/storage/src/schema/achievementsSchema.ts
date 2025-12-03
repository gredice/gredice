import { relations } from 'drizzle-orm';
import {
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accounts, users } from './usersSchema';

export const achievementStatusEnum = pgEnum('achievement_status', [
    'pending',
    'approved',
    'denied',
]);

export const accountAchievements = pgTable(
    'account_achievements',
    {
        id: serial('id').primaryKey(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        achievementKey: text('achievement_key').notNull(),
        status: achievementStatusEnum('status').notNull().default('pending'),
        rewardSunflowers: integer('reward_sunflowers').notNull().default(0),
        progressValue: integer('progress_value'),
        threshold: integer('threshold'),
        metadata: jsonb('metadata'),
        earnedAt: timestamp('earned_at').notNull().defaultNow(),
        approvedAt: timestamp('approved_at'),
        approvedByUserId: text('approved_by_user_id').references(
            () => users.id,
        ),
        rewardGrantedAt: timestamp('reward_granted_at'),
        deniedAt: timestamp('denied_at'),
        deniedByUserId: text('denied_by_user_id').references(() => users.id),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('account_achievements_account_id_idx').on(table.accountId),
        index('account_achievements_status_idx').on(table.status),
        uniqueIndex('account_achievements_account_key_uq').on(
            table.accountId,
            table.achievementKey,
        ),
    ],
);

export const accountAchievementsRelations = relations(
    accountAchievements,
    ({ one }) => ({
        account: one(accounts, {
            fields: [accountAchievements.accountId],
            references: [accounts.id],
            relationName: 'accountAchievements',
        }),
        approvedBy: one(users, {
            fields: [accountAchievements.approvedByUserId],
            references: [users.id],
            relationName: 'approvedAchievements',
        }),
        deniedBy: one(users, {
            fields: [accountAchievements.deniedByUserId],
            references: [users.id],
            relationName: 'deniedAchievements',
        }),
    }),
);

export type InsertAccountAchievement = typeof accountAchievements.$inferInsert;
export type SelectAccountAchievement = typeof accountAchievements.$inferSelect;
export type UpdateAccountAchievement = Partial<
    Omit<
        typeof accountAchievements.$inferInsert,
        'id' | 'accountId' | 'createdAt' | 'updatedAt' | 'achievementKey'
    >
> & { id: number };
