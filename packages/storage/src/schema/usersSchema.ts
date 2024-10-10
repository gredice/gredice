import { relations } from "drizzle-orm";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const accounts = pgTable('accounts', {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
});

export const accountUsers = pgTable('account_users', {
    id: serial('id').primaryKey(),
    accountId: text('account_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
});

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
});

export const usersRelations = relations(users, ({ one, many }) => ({
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
    userId: text('user_id').notNull(),
    loginType: text('login_type').notNull(),
    loginId: text('login_id').notNull(),
    loginData: text('login_data').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
});

export const userLoginsRelations = relations(userLogins, ({ one }) => ({
    user: one(users, {
        fields: [userLogins.userId],
        references: [users.id],
        relationName: 'usersLogins',
    })
}));

export type InsertUserLogin = typeof userLogins.$inferInsert;
export type SelectUserLogin = typeof userLogins.$inferSelect;