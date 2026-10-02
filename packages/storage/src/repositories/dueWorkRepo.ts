import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { deliveryLifecycleNotificationMaximumAgeSeconds } from '../deliveryNotificationPolicy';
import type { DueWorkJob } from '../dueWork';
import { storage } from '../storage';
import { getDeliveryLifecycleReconciliationCandidates } from './deliveryLifecycleNotificationsRepo';
import { getDeliveryLifecycleEmailCandidates } from './notificationsRepo';
import { listActiveStripeCheckoutAttemptsForReconciliation } from './stripeCheckoutAttemptRepo';

async function minimumDueAt(query: ReturnType<typeof sql>, now: Date) {
    const result = await storage().execute<{ dueAt: string | Date | null }>(
        query,
    );
    const { rows } = z
        .object({
            rows: z.array(
                z.object({
                    dueAt: z.union([z.string(), z.date()]).nullable(),
                }),
            ),
        })
        .parse(result);
    const value = rows[0]?.dueAt;
    if (!value) return null;
    const dueAt = new Date(value);
    // Malformed queue metadata must stay actionable instead of hiding work.
    return Number.isNaN(dueAt.getTime()) ? now : dueAt;
}

// These projections run after actual work or the hourly recovery window, never
// as the minute poll's idle preflight. They transfer no queue payloads.
export async function getNextDueWorkAt(
    job: DueWorkJob,
    now = new Date(),
): Promise<Date | null> {
    if (job === 'automations') {
        return minimumDueAt(
            sql`
            select min(due_at) as "dueAt" from (
                select case when status = 'running' then locked_at + interval '15 minutes' else next_run_at end as due_at
                from automation_runs where status in ('queued', 'retrying', 'running')
                union all select ${now}::timestamptz where exists (
                    select 1 from events e where e.id > coalesce((select last_event_id from automation_event_cursors where key = 'domain-events'), 0)
                        and exists (select 1 from automation_definitions d where d.status = 'enabled' and d.trigger_event_type = e.type)
                )
            ) due_work
        `,
            now,
        );
    }
    if (
        job === 'order-confirmation-emails' ||
        job === 'checkout-notifications'
    ) {
        const kind =
            job === 'order-confirmation-emails'
                ? 'order_confirmation'
                : 'checkout_notification';
        return minimumDueAt(
            sql`
            select min(case
                when status = 'queued' then coalesce(nullif(metadata->>'nextAttemptAt', '')::timestamptz, queued_at)
                when provider_status = 'outbox_claimed' then coalesce(nullif(metadata->>'claimExpiresAt', '')::timestamptz, ${now})
                when ${kind} = 'order_confirmation' and provider_status = 'submission_started'
                    then coalesce(nullif(metadata->>'submissionStartedAt', '')::timestamptz, updated_at) + interval '5 minutes'
                when ${kind} = 'order_confirmation' and provider_status = 'submission_uncertain'
                    then coalesce(nullif(metadata->>'submissionUncertainAt', '')::timestamptz, updated_at) + interval '5 minutes'
                when ${kind} = 'order_confirmation' and provider_status = 'reconciliation_pending'
                    then coalesce(nullif(metadata->>'nextReconciliationAt', '')::timestamptz, ${now})
                when ${kind} = 'order_confirmation' and provider_status = 'reconciliation_claimed'
                    then coalesce(nullif(metadata->>'reconciliationClaimExpiresAt', '')::timestamptz, ${now})
                else null end) as "dueAt"
            from email_messages where metadata->>'outboxKind' = ${kind} and status in ('queued', 'sending')
        `,
            now,
        );
    }
    if (job === 'delivery-lifecycle-emails') {
        if (
            !(await getDeliveryLifecycleEmailCandidates({ limit: 1, now }))
                .length
        ) {
            return minimumDueAt(
                sql`
                select min(case when a.provider_response_code = 'quiet_hours' then a.attempted_at
                    else a.attempted_at + interval '5 minutes' end) as "dueAt"
                from notification_delivery_attempts a join notifications n on n.id = a.notification_id
                where a.provider = 'delivery_lifecycle_email' and a.status = 'queued'
                  and a.provider_response_code is distinct from 'sending'
                  and (case when a.provider_response_code = 'quiet_hours' then a.attempted_at
                    else a.attempted_at + interval '5 minutes' end) > ${now}
                  and n.timestamp + least(coalesce(n.ttl_seconds, ${deliveryLifecycleNotificationMaximumAgeSeconds}), ${deliveryLifecycleNotificationMaximumAgeSeconds}) * interval '1 second'
                    > (case when a.provider_response_code = 'quiet_hours' then a.attempted_at
                    else a.attempted_at + interval '5 minutes' end)
                  and not exists (select 1 from notification_delivery_attempts completed
                    where completed.notification_id = a.notification_id and completed.user_id = a.user_id
                      and completed.provider = a.provider and
                        (completed.status in ('accepted', 'sent', 'dropped') or
                        (completed.status = 'queued' and completed.provider_response_code = 'sending')))
            `,
                now,
            );
        }
        return now;
    }
    if (job === 'delivery-lifecycle-reconciliation') {
        const startedAtValue =
            process.env.GREDICE_DELIVERY_NOTIFICATION_ROLLOUT_STARTED_AT;
        if (
            process.env.GREDICE_DELIVERY_NOTIFICATION_RECONCILIATION_ENABLED?.trim().toLowerCase() !==
                'true' ||
            process.env.GREDICE_DELIVERY_NOTIFICATIONS_ENABLED?.trim().toLowerCase() !==
                'true' ||
            !startedAtValue
        )
            return null;
        const startedAt = new Date(startedAtValue.trim());
        if (
            Number.isNaN(startedAt.getTime()) ||
            startedAt.toISOString() !== startedAtValue.trim()
        )
            return null;
        const candidates = await getDeliveryLifecycleReconciliationCandidates({
            startedAt,
            limit: 1,
        });
        return candidates.sourceCount > 0 ? now : null;
    }
    if (job === 'stripe-checkout-orphan-recovery') {
        const attempts =
            await listActiveStripeCheckoutAttemptsForReconciliation({
                limit: 1,
            });
        // The caller retains its five-minute schedule while an attempt exists.
        return attempts.items.length > 0 ? now : null;
    }
    return minimumDueAt(
        sql`
        select min(case when status = 'queued' then ${now} else scheduled_at end) as "dueAt"
        from social_posts where status in ('queued', 'scheduled')
    `,
        now,
    );
}
