import { pgTable, serial, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { accounts, users } from "./usersSchema";

export const notifications = pgTable('notifications', {
    id: serial('id').primaryKey(),
    header: text('header').notNull(),
    content: text('content').notNull(), // markdown content
    image: text('image'),
    userId: text('user_id').references(() => users.id),
    accountId: text('account_id').references(() => accounts.id),
    read: boolean('read').notNull().default(false),
    readWhere: text('read_where'), // e.g. 'web', 'mobile', ...
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_account_id_idx').on(table.accountId),
    index('notifications_read_idx').on(table.read),
    index('notifications_created_at_idx').on(table.createdAt),
]);

export type InsertNotification = Omit<typeof notifications.$inferInsert, 'id' | 'createdAt'>;
export type UpdateNotification = Partial<Omit<typeof notifications.$inferInsert, 'id' | 'createdAt'>> & { id: number };
export type SelectNotification = typeof notifications.$inferSelect;
