import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
    index,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';

export const newsletterStatusEnum = pgEnum('newsletter_status', [
    'subscribed',
    'unsubscribed',
    'pending',
]);

export type NewsletterStatus = (typeof newsletterStatusEnum.enumValues)[number];

export const newsletterSubscribers = pgTable(
    'newsletter_subscribers',
    {
        id: serial('id').primaryKey(),
        email: text('email').notNull(),
        status: newsletterStatusEnum('status').notNull().default('subscribed'),
        source: text('source'),
        subscribedAt: timestamp('subscribed_at').notNull().defaultNow(),
        unsubscribedAt: timestamp('unsubscribed_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('newsletter_subscribers_email_idx').on(table.email),
        index('newsletter_subscribers_status_idx').on(table.status),
    ],
);

export type InsertNewsletterSubscriber = InferInsertModel<
    typeof newsletterSubscribers
>;
export type SelectNewsletterSubscriber = InferSelectModel<
    typeof newsletterSubscribers
>;
