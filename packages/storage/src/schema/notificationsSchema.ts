import { pgTable, serial, text, timestamp, boolean, index, integer } from "drizzle-orm/pg-core";
import { accounts, users } from "./usersSchema";
import { gardenBlocks, gardens } from "./gardenSchema";
import { relations } from "drizzle-orm";

export const notifications = pgTable('notifications', {
    id: text('id').primaryKey(),
    header: text('header').notNull(),
    content: text('content').notNull(), // markdown content
    imageUrl: text('image'),
    linkUrl: text('link_url'), // optional link to more details
    accountId: text('account_id').notNull().references(() => accounts.id),
    userId: text('user_id').references(() => users.id), // optional, for user-specific notifications
    gardenId: integer('garden_id').references(() => gardens.id), // optional, for garden-specific notifications
    blockId: text('block_id').references(() => gardenBlocks.id), // optional, for block-specific notifications
    readAt: timestamp('read_at'), // null if not read
    readWhere: text('read_where'), // e.g. 'web', 'mobile', ...
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('notifications_account_id_idx').on(table.accountId),
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_readAt_idx').on(table.readAt),
    index('notifications_created_at_idx').on(table.createdAt),
]);

export const notificationsRelations = relations(notifications, ({ one }) => ({
    account: one(accounts, {
        fields: [notifications.accountId],
        references: [accounts.id],
        relationName: 'notificationsAccount',
    }),
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
        relationName: 'notificationsUser',
    }),
    garden: one(gardens, {
        fields: [notifications.gardenId],
        references: [gardens.id],
        relationName: 'notificationsGarden',
    }),
    block: one(gardenBlocks, {
        fields: [notifications.blockId],
        references: [gardenBlocks.id],
        relationName: 'notificationsBlock',
    }),
}));

export type InsertNotification = Omit<typeof notifications.$inferInsert, 'id'>;
export type UpdateNotification = Partial<Omit<typeof notifications.$inferInsert, 'id' | 'createdAt'>> & { id: number };
export type SelectNotification = typeof notifications.$inferSelect;

export const userNotificationSettings = pgTable("user_notification_settings", {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).primaryKey(),
    emailEnabled: boolean("email_enabled").notNull().default(true),  // user can disable all emails
    dailyDigest: boolean("daily_digest").notNull().default(true)     // true = daily summary, false = immediate emails
});

export const notificationEmailLog = pgTable("notification_email_log", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    notificationId: text("notification_id").notNull().references(() => notifications.id),
    emailedAt: timestamp("emailed_at").notNull().defaultNow()
});
