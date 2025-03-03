import { relations } from "drizzle-orm";
import { index, pgTable, serial, smallint, text, timestamp } from "drizzle-orm/pg-core";

export const accounts = pgTable('accounts', {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
});

export const accountUsers = pgTable('account_users', {
    id: serial('id').primaryKey(),
    accountId: text('account_id').notNull().references(() => accounts.id),
    userId: text('user_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
}, (table) => [
    index('users_au_account_id_idx').on(table.accountId),
    index('users_au_user_id_idx').on(table.userId),
]);

export const accountUsersRelations = relations(accountUsers, ({ one }) => ({
    account: one(accounts, {
        fields: [accountUsers.accountId],
        references: [accounts.id],
        relationName: 'account',
    }),
    user: one(users, {
        fields: [accountUsers.userId],
        references: [users.id],
        relationName: 'accountUsers',
    })
}));

export const users = pgTable('users', {
    id: text('id').primaryKey(),
    userName: text('username').notNull(),
    role: text('role').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
}, (table) => [
    index('users_u_username_idx').on(table.userName),
]);

export const usersRelations = relations(users, ({ many }) => ({
    usersLogins: many(userLogins, {
        relationName: 'usersLogins',
    }),
    accounts: many(accountUsers, {
        relationName: 'accountUsers',
    })
}));

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export const userLogins = pgTable('user_logins', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    loginType: text('login_type').notNull(),
    loginId: text('login_id').notNull(),
    loginData: text('login_data').notNull(),
    lastLogin: timestamp('last_login'),
    failedAttempts: smallint('failed_attempts').notNull().default(0),
    lastFailedAttempt: timestamp('last_failed_attempt'),
    blockedUntil: timestamp('blocked_until'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
}, (table) => [
    index('users_ul_user_id_idx').on(table.userId),
    index('users_ul_login_type_idx').on(table.loginType),
    index('users_ul_login_id_idx').on(table.loginId),
]);

export const userLoginsRelations = relations(userLogins, ({ one }) => ({
    user: one(users, {
        fields: [userLogins.userId],
        references: [users.id],
        relationName: 'usersLogins',
    })
}));

export type InsertUserLogin = typeof userLogins.$inferInsert;
export type SelectUserLogin = typeof userLogins.$inferSelect;