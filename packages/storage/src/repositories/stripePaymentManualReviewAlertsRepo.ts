import 'server-only';
import { and, asc, desc, eq, notExists, sql } from 'drizzle-orm';
import { signalDueWork } from '../dueWork';
import {
    emailMessages,
    events,
    stripePaymentProcessingClaimReviews,
    stripePaymentProcessingClaims,
} from '../schema';
import { storage } from '../storage';
import {
    checkoutNotificationOutboxKind,
    enqueueStripePaymentManualReviewAlert,
} from './checkoutNotificationOutboxRepo';
import { createEvent } from './eventsRepo';

type Database = ReturnType<typeof storage>;

export const stripePaymentManualReviewAlertEventType =
    'checkout.payment.manualReviewAlert';
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

function failureCategory(reason: string | null) {
    if (
        reason &&
        [
            'checkout_operation_conflict',
            'attempt_limit_reached',
            'transaction_identity_conflict',
        ].includes(reason)
    )
        return reason;
    if (reason?.startsWith('checkout_attempt_'))
        return 'checkout_attempt_conflict';
    if (reason?.startsWith('completion_output_'))
        return 'completion_output_conflict';
    return 'processing_failure';
}

// The caller holds the claim row lock. Persist the privacy-safe source with the
// state transition, independently of outbox enqueue/delivery. Review commands
// also capture pre-rollout manual claims before changing their actionable state.
export async function recordStripePaymentManualReviewAlertSource(
    claim: Pick<
        typeof stripePaymentProcessingClaims.$inferSelect,
        'schedulerId' | 'stripePaymentId'
    >,
    reason: string | null,
    tx: Transaction,
) {
    const [review] = await tx
        .select({ id: stripePaymentProcessingClaimReviews.id })
        .from(stripePaymentProcessingClaimReviews)
        .where(
            and(
                eq(
                    stripePaymentProcessingClaimReviews.stripePaymentId,
                    claim.stripePaymentId,
                ),
                eq(stripePaymentProcessingClaimReviews.action, 'requeued'),
            ),
        )
        .orderBy(desc(stripePaymentProcessingClaimReviews.id))
        .limit(1);
    const reviewCycleId = review?.id ?? 0;
    const aggregateId = `stripePaymentClaim:${claim.schedulerId}:${reviewCycleId}`;
    const [existing] = await tx
        .select({ id: events.id })
        .from(events)
        .where(
            and(
                eq(events.type, stripePaymentManualReviewAlertEventType),
                eq(events.aggregateId, aggregateId),
            ),
        )
        .limit(1);
    if (existing) return;
    await createEvent(
        {
            type: stripePaymentManualReviewAlertEventType,
            version: 1,
            aggregateId,
            data: {
                paymentClaimId: claim.schedulerId,
                reviewCycleId,
                failureCategory: failureCategory(reason),
            },
        },
        tx,
    );
    await signalDueWork('checkout-notifications');
}

// Only new durable sources and currently actionable legacy claims are eligible.
// Do not retrospectively alert on historical, already-resolved review decisions.
const alertSources = sql`(
    select c.stripe_payment_id as payment_id, c.scheduler_id::double precision as claim_id,
        coalesce((select max(r.id) from stripe_payment_processing_claim_reviews r
            where r.stripe_payment_id = c.stripe_payment_id and r.action = 'requeued'), 0) as cycle_id,
        c.manual_review_reason as reason
    from stripe_payment_processing_claims c where c.status = 'manual_review'
        and not exists (select 1 from events source_event
            where source_event.type = ${stripePaymentManualReviewAlertEventType}
            and source_event.aggregate_id = 'stripePaymentClaim:' || c.scheduler_id::text || ':' ||
                coalesce((select max(r.id) from stripe_payment_processing_claim_reviews r
                    where r.stripe_payment_id = c.stripe_payment_id and r.action = 'requeued'), 0)::text)
    union all
    select c.stripe_payment_id, c.scheduler_id::double precision,
        (e.data->>'reviewCycleId')::integer, e.data->>'failureCategory'
    from events e join stripe_payment_processing_claims c on c.scheduler_id::text = e.data->>'paymentClaimId'
    where e.type = ${stripePaymentManualReviewAlertEventType} and e.version = 1
) review_alert_source`;
const sourcePaymentId = sql<string>`review_alert_source.payment_id`;
const sourceClaimId = sql<number>`review_alert_source.claim_id`;
const sourceCycleId = sql<number>`review_alert_source.cycle_id`;
const sourceReason = sql<string | null>`review_alert_source.reason`;

function sources(database: Database) {
    return database
        .select({
            stripePaymentId: sourcePaymentId,
            paymentClaimId: sourceClaimId,
            reviewCycleId: sourceCycleId,
            reason: sourceReason,
        })
        .from(alertSources);
}

export async function ensureStripePaymentManualReviewAlert(
    stripePaymentId: string,
    {
        database = storage(),
        reviewCycleId,
    }: { database?: Database; reviewCycleId?: number } = {},
) {
    return database.transaction(async (tx) => {
        const [claim] = await tx
            .select()
            .from(stripePaymentProcessingClaims)
            .where(
                eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    stripePaymentId,
                ),
            )
            .for('update')
            .limit(1);
        if (!claim) return;
        if (claim.status === 'manual_review') {
            await recordStripePaymentManualReviewAlertSource(
                claim,
                claim.manualReviewReason,
                tx,
            );
        }
        const [source] = await tx
            .select({ reviewCycleId: sourceCycleId, reason: sourceReason })
            .from(alertSources)
            .where(
                and(
                    eq(sourcePaymentId, stripePaymentId),
                    reviewCycleId === undefined
                        ? undefined
                        : eq(sourceCycleId, reviewCycleId),
                ),
            )
            .orderBy(desc(sourceCycleId))
            .limit(1);
        if (!source) return;
        return enqueueStripePaymentManualReviewAlert(
            {
                kind: 'payment_manual_review_slack',
                paymentClaimId: claim.schedulerId,
                reviewCycleId: source.reviewCycleId,
                failureCategory: failureCategory(source.reason),
            },
            tx,
        );
    });
}

// Called only after the claim transaction commits. A failed enqueue must not
// undo manual review or a separately committed fulfillment effect.
export async function tryEnsureStripePaymentManualReviewAlert(
    stripePaymentId: string,
    database: Database,
) {
    try {
        await ensureStripePaymentManualReviewAlert(stripePaymentId, {
            database,
        });
    } catch {
        console.error('stripe_payment.manual_review.alert_enqueue_failed', {
            failureCode: 'alert_enqueue_failed',
        });
        await signalDueWork('checkout-notifications');
    }
}

export async function repairStripePaymentManualReviewAlerts({
    database = storage(),
    limit = 20,
}: {
    database?: Database;
    limit?: number;
} = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new RangeError(
            'Manual-review alert repair limit must be 1 to 100',
        );
    }
    // Exclude every existing intent, including sent/failed/uncertain ones. This
    // prevents an old incident from starving later missing intents or resending.
    const missing = () =>
        notExists(
            database
                .select({ id: emailMessages.id })
                .from(emailMessages)
                .where(
                    and(
                        sql`${emailMessages.metadata}->>'outboxKind' = ${checkoutNotificationOutboxKind}`,
                        sql`${emailMessages.metadata}->>'notificationKind' = 'payment_manual_review_slack'`,
                        sql`${emailMessages.metadata}->>'paymentClaimId' = ${sourceClaimId}::bigint::text`,
                        sql`${emailMessages.metadata}->>'reviewCycleId' = ${sourceCycleId}::text`,
                    ),
                ),
        );
    const candidates = await sources(database)
        .where(missing())
        .orderBy(asc(sourceClaimId), asc(sourceCycleId))
        .limit(limit);
    let failed = 0;
    for (const candidate of candidates) {
        try {
            await ensureStripePaymentManualReviewAlert(
                candidate.stripePaymentId,
                { database, reviewCycleId: candidate.reviewCycleId },
            );
        } catch {
            failed += 1;
            console.error('stripe_payment.manual_review.alert_enqueue_failed', {
                failureCode: 'alert_enqueue_failed',
            });
        }
    }
    const [pending] = await sources(database).where(missing()).limit(1);
    return { failed, pending: Boolean(pending) };
}
