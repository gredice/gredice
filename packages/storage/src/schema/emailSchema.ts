import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import {
    index,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';

export const emailStatusEnum = pgEnum('email_status', [
    'queued',
    'sending',
    'sent',
    'failed',
    'bounced',
]);

export type EmailStatus = (typeof emailStatusEnum.enumValues)[number];

export type EmailLogRecipient = {
    address: string;
    displayName?: string | null;
};

export type EmailLogRecipients = {
    to: EmailLogRecipient[];
    cc?: EmailLogRecipient[];
    bcc?: EmailLogRecipient[];
    replyTo?: EmailLogRecipient[];
};

export type EmailLogAttachment = {
    name: string;
    contentType: string;
    size?: number;
};

export const emailMessages = pgTable(
    'email_messages',
    {
        id: serial('id').primaryKey(),
        provider: text('provider').notNull().default('acs'),
        providerMessageId: text('provider_message_id'),
        status: emailStatusEnum('status').notNull().default('queued'),
        providerStatus: text('provider_status'),
        fromAddress: text('from_address').notNull(),
        subject: text('subject').notNull(),
        templateName: text('template_name'),
        messageType: text('message_type'),
        recipients: jsonb('recipients').$type<EmailLogRecipients>().notNull(),
        attachments: jsonb('attachments')
            .$type<EmailLogAttachment[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        htmlBody: text('html_body'),
        textBody: text('text_body'),
        errorCode: text('error_code'),
        errorMessage: text('error_message'),
        queuedAt: timestamp('queued_at').notNull().defaultNow(),
        sentAt: timestamp('sent_at'),
        completedAt: timestamp('completed_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        lastAttemptAt: timestamp('last_attempt_at'),
        bouncedAt: timestamp('bounced_at'),
    },
    (table) => [
        index('email_messages_status_idx').on(table.status),
        index('email_messages_created_idx').on(table.createdAt),
        index('email_messages_provider_message_idx').on(
            table.providerMessageId,
        ),
    ],
);

export type InsertEmailMessage = InferInsertModel<typeof emailMessages>;
export type SelectEmailMessage = InferSelectModel<typeof emailMessages>;
