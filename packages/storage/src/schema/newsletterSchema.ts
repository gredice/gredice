import {
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';

export const newsletterSubscriptions = pgTable(
    'newsletter_subscriptions',
    {
        id: serial('id').primaryKey(),
        email: text('email').notNull(),
        source: text('source'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        unsubscribedAt: timestamp('unsubscribed_at'),
    },
    (table) => [
        uniqueIndex('newsletter_subscriptions_email_idx').on(table.email),
    ],
);

export type InsertNewsletterSubscription =
    typeof newsletterSubscriptions.$inferInsert;
export type SelectNewsletterSubscription =
    typeof newsletterSubscriptions.$inferSelect;
