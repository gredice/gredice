import { json, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const feedbacks = pgTable('feedbacks', {
    id: text('id').primaryKey(),
    topic: text('topic').notNull(),
    data: json('data'),
    score: text('score'),
    comment: text('comment'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type InsertFeedback = Omit<
    typeof feedbacks.$inferInsert,
    'id' | 'createdAt'
>;
export type SelectFeedback = typeof feedbacks.$inferSelect;
