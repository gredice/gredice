import { relations, sql } from 'drizzle-orm';
import {
    bigint,
    boolean,
    check,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { emailMessages } from './emailSchema';
import { gardens } from './gardenSchema';
import { invoices } from './invoiceSchema';
import { accounts } from './usersSchema';

export const transactions = pgTable(
    'transactions',
    {
        id: serial('id').primaryKey(),
        accountId: text('account_id').references(() => accounts.id),
        gardenId: integer('garden_id').references(() => gardens.id),
        stripePaymentId: text('stripe_payment_id').notNull(),
        amount: integer('amount').notNull(),
        currency: text('currency').notNull(),
        status: text('status').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('transactions_account_id_idx').on(table.accountId),
        index('transactions_garden_id_idx').on(table.gardenId),
        uniqueIndex('transactions_stripe_payment_id_unique').on(
            table.stripePaymentId,
        ),
        index('transactions_is_deleted_idx').on(table.isDeleted),
    ],
);

export const stripePaymentProcessingClaimStatuses = [
    'queued',
    'processing',
    'retryable',
    'completed',
    'manual_review',
] as const;

export const stripePaymentProcessingClaimStatusEnum = pgEnum(
    'stripe_payment_processing_claim_status',
    stripePaymentProcessingClaimStatuses,
);

export const stripePaymentProcessingClaimReviewActions = [
    'requeued',
    'resolved_completed',
] as const;

export const stripePaymentProcessingClaimReviewActionEnum = pgEnum(
    'stripe_payment_processing_claim_review_action',
    stripePaymentProcessingClaimReviewActions,
);

export type StripePaymentProcessingClaimStatus =
    (typeof stripePaymentProcessingClaimStatusEnum.enumValues)[number];

/**
 * Durable, lease-fenced ownership for paid Stripe Checkout processing.
 *
 * The Stripe session ID is the primary key so webhook and cron deliveries
 * converge on one claim. The claim transaction is intentionally short; all
 * provider calls and fulfillment work happen after it commits.
 */
export const stripePaymentProcessingClaims = pgTable(
    'stripe_payment_processing_claims',
    {
        stripePaymentId: text('stripe_payment_id').primaryKey(),
        schedulerId: bigint('scheduler_id', { mode: 'number' })
            .notNull()
            .generatedAlwaysAsIdentity(),
        status: stripePaymentProcessingClaimStatusEnum('status').notNull(),
        claimToken: text('claim_token'),
        attemptCount: integer('attempt_count').notNull().default(0),
        attemptCountAtLastRequeue: integer('attempt_count_at_last_requeue')
            .notNull()
            .default(0),
        claimedAt: timestamp('claimed_at'),
        leaseExpiresAt: timestamp('lease_expires_at'),
        nextAttemptAt: timestamp('next_attempt_at'),
        lastFailureAt: timestamp('last_failure_at'),
        lastFailureCode: text('last_failure_code'),
        completedAt: timestamp('completed_at'),
        completedTransactionId: integer('completed_transaction_id').references(
            () => transactions.id,
        ),
        completionOutputVersion: integer('completion_output_version')
            .notNull()
            .default(1),
        orderConfirmationEmailMessageId: integer(
            'order_confirmation_email_message_id',
        ).references(() => emailMessages.id),
        purchaseNotificationEmailMessageId: integer(
            'purchase_notification_email_message_id',
        ).references(() => emailMessages.id),
        manualReviewAt: timestamp('manual_review_at'),
        manualReviewReason: text('manual_review_reason'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('stripe_payment_claim_scheduler_id_unique').on(
            table.schedulerId,
        ),
        index('stripe_payment_claim_status_next_attempt_idx').on(
            table.status,
            table.nextAttemptAt,
        ),
        index('stripe_payment_claim_status_lease_expiry_idx').on(
            table.status,
            table.leaseExpiresAt,
        ),
        index('stripe_payment_claim_completed_transaction_idx').on(
            table.completedTransactionId,
        ),
    ],
);

/**
 * Singleton, revision-fenced cursor for bounded Stripe session discovery.
 * Provider timestamps remain frozen until every page in the range is durable.
 */
export const stripePaymentDiscoveryCheckpoints = pgTable(
    'stripe_payment_discovery_checkpoints',
    {
        id: integer('id').primaryKey(),
        revision: integer('revision').notNull().default(0),
        rangeGte: timestamp('range_gte'),
        rangeLte: timestamp('range_lte'),
        startingAfter: text('starting_after'),
        exhaustiveUpperBound: timestamp('exhaustive_upper_bound'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        check(
            'stripe_payment_discovery_checkpoint_singleton',
            sql`${table.id} = 1`,
        ),
    ],
);

/**
 * Singleton fair-scan cursor. `throughSchedulerId` freezes each pass while
 * `afterSchedulerId` advances before the selected callback is run.
 */
export const stripePaymentRecoveryCursors = pgTable(
    'stripe_payment_recovery_cursors',
    {
        id: integer('id').primaryKey(),
        revision: integer('revision').notNull().default(0),
        afterSchedulerId: bigint('after_scheduler_id', { mode: 'number' }),
        throughSchedulerId: bigint('through_scheduler_id', { mode: 'number' }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        check('stripe_payment_recovery_cursor_singleton', sql`${table.id} = 1`),
    ],
);

/**
 * Append-only operator audit trail for manual-review claim decisions.
 */
export const stripePaymentProcessingClaimReviews = pgTable(
    'stripe_payment_processing_claim_reviews',
    {
        id: serial('id').primaryKey(),
        stripePaymentId: text('stripe_payment_id')
            .notNull()
            .references(() => stripePaymentProcessingClaims.stripePaymentId),
        action: stripePaymentProcessingClaimReviewActionEnum(
            'action',
        ).notNull(),
        previousAttemptCount: integer('previous_attempt_count').notNull(),
        previousManualReviewReason: text('previous_manual_review_reason'),
        reviewedBy: text('reviewed_by').notNull(),
        reason: text('reason').notNull(),
        completedTransactionId: integer('completed_transaction_id').references(
            () => transactions.id,
        ),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('stripe_payment_claim_review_payment_created_idx').on(
            table.stripePaymentId,
            table.createdAt,
        ),
    ],
);

export const transactionRelations = relations(
    transactions,
    ({ one, many }) => ({
        account: one(accounts, {
            fields: [transactions.accountId],
            references: [accounts.id],
            relationName: 'transactionAccount',
        }),
        garden: one(gardens, {
            fields: [transactions.gardenId],
            references: [gardens.id],
            relationName: 'transactionGarden',
        }),
        invoices: many(invoices, {
            relationName: 'invoiceTransaction',
        }),
    }),
);

export type InsertTransaction = typeof transactions.$inferInsert;
export type UpdateTransaction = Partial<
    Omit<
        typeof transactions.$inferInsert,
        | 'id'
        | 'accountId'
        | 'gardenId'
        | 'stripePaymentId'
        | 'createdAt'
        | 'updatedAt'
        | 'isDeleted'
    >
> &
    Pick<typeof transactions.$inferSelect, 'id'>;
export type SelectTransaction = typeof transactions.$inferSelect;
export type SelectStripePaymentProcessingClaim =
    typeof stripePaymentProcessingClaims.$inferSelect;
export type SelectStripePaymentProcessingClaimReview =
    typeof stripePaymentProcessingClaimReviews.$inferSelect;
export type SelectStripePaymentDiscoveryCheckpoint =
    typeof stripePaymentDiscoveryCheckpoints.$inferSelect;
export type SelectStripePaymentRecoveryCursor =
    typeof stripePaymentRecoveryCursors.$inferSelect;
