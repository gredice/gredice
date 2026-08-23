import { and, desc, eq, gte, inArray, lt, lte, ne, or, sql } from 'drizzle-orm';
import 'server-only';
import { deliveryLifecycleNotificationMaximumAgeSeconds } from '../deliveryNotificationPolicy';
import {
    events,
    notificationDeliveryAttempts,
    notificationDeliveryEvents,
    notifications,
} from '../schema';
import { storage } from '../storage';
import { knownEventTypes } from './events';

const diagnosticDefaultWindowMs = 24 * 60 * 60 * 1000;
const healthDefaultWindowMs = 15 * 60 * 1000;
const maximumWindowMs = 180 * 24 * 60 * 60 * 1000;
const maximumPageSize = 200;
const defaultPageSize = 50;
const staleQueueAgeMs = 10 * 60 * 1000;

const deliveryLifecycleMilestones = [
    'route-started',
    'near-arrival',
    'next-stop',
    'delayed',
    'arrived',
    'delivered',
    'exception',
    'recovery',
] as const;

const notificationChannels = ['in_app', 'email', 'push', 'sms'] as const;

export const deliveryLifecycleNotificationOutcomes = [
    'suppressed',
    'deferred',
    'retrying',
    'queued',
    'accepted',
    'sent',
    'failed',
    'opened',
    'clicked',
    'dismissed',
    'unsubscribed',
] as const;

export type DeliveryLifecycleNotificationMilestone =
    (typeof deliveryLifecycleMilestones)[number];
export type DeliveryLifecycleNotificationChannel =
    (typeof notificationChannels)[number];
export type DeliveryLifecycleNotificationOutcome =
    (typeof deliveryLifecycleNotificationOutcomes)[number];
export type DeliveryLifecycleNotificationProvider =
    | 'router'
    | 'email'
    | 'push'
    | 'unknown';
export type DeliveryLifecycleNotificationReasonCode =
    | 'attempts_exhausted'
    | 'claim_expired_before_send'
    | 'claimed'
    | 'digest_daily'
    | 'digest_hourly'
    | 'digest_weekly'
    | 'eligible_after_quiet_hours'
    | 'eligible_immediate'
    | 'invalid_payload'
    | 'invalid_recipient'
    | 'idempotency_reused'
    | 'missing_push_subscription'
    | 'not_recipient'
    | 'notification_expired'
    | 'notification_missing'
    | 'preference_disabled'
    | 'provider_rejected'
    | 'queued_background'
    | 'quiet_hours'
    | 'required_notification'
    | 'sender_failed'
    | 'sending'
    | 'sent'
    | 'eta_threshold_already_emitted'
    | 'unknown';

type DeliveryAttemptStatus =
    | 'queued'
    | 'accepted'
    | 'sent'
    | 'failed'
    | 'dropped';
type DeliveryEventType =
    | 'queued'
    | 'accepted'
    | 'sent'
    | 'failed'
    | 'opened'
    | 'clicked'
    | 'dismissed'
    | 'unsubscribed';

export type DeliveryLifecycleNotificationOutcomeInput = {
    attemptStatus: DeliveryAttemptStatus;
    eventReasonCode?: string | null;
    eventRetryable?: boolean;
    eventType?: DeliveryEventType | null;
    provider?: string | null;
    providerResponseCode?: string | null;
};

const intentionalSuppressionReasonCodes = [
    'digest_daily',
    'digest_hourly',
    'digest_weekly',
    'invalid_recipient',
    'missing_push_subscription',
    'not_recipient',
    'notification_expired',
    'preference_disabled',
] as const;

function isIntentionalSuppressionReason(
    value: string | null | undefined,
): boolean {
    return intentionalSuppressionReasonCodes.some((reason) => reason === value);
}

export function classifyDeliveryLifecycleNotificationOutcome({
    attemptStatus,
    eventReasonCode,
    eventRetryable = false,
    eventType,
    provider,
    providerResponseCode,
}: DeliveryLifecycleNotificationOutcomeInput): DeliveryLifecycleNotificationOutcome {
    if (eventType === 'queued' && eventReasonCode === 'quiet_hours') {
        return 'deferred';
    }
    if (
        eventType === 'failed' &&
        isIntentionalSuppressionReason(eventReasonCode)
    ) {
        return 'suppressed';
    }
    if (eventType === 'failed' && eventRetryable) return 'retrying';
    if (eventType) return eventType;
    if (providerResponseCode === 'quiet_hours') return 'deferred';
    if (
        attemptStatus === 'dropped' &&
        (provider === 'router' ||
            isIntentionalSuppressionReason(providerResponseCode))
    ) {
        return 'suppressed';
    }
    if (attemptStatus === 'dropped') return 'failed';
    return attemptStatus;
}

export type DeliveryLifecycleNotificationDiagnosticsFilters = {
    channel?: DeliveryLifecycleNotificationChannel;
    cursor?: string;
    from?: Date;
    limit?: number;
    milestone?: DeliveryLifecycleNotificationMilestone;
    now?: Date;
    outcome?: DeliveryLifecycleNotificationOutcome;
    requestId?: string;
    sourceId?: string;
    to?: Date;
};

export type DeliveryLifecycleNotificationDiagnostic = {
    attemptId: number | null;
    channel: DeliveryLifecycleNotificationChannel | null;
    kind: 'attempt' | 'decision';
    milestone: DeliveryLifecycleNotificationMilestone;
    notificationId: string | null;
    occurredAt: Date;
    outcome: DeliveryLifecycleNotificationOutcome;
    provider: DeliveryLifecycleNotificationProvider;
    reasonCode: DeliveryLifecycleNotificationReasonCode;
    recordId: string;
    requestId: string;
    sourceId: string | null;
};

export type DeliveryLifecycleNotificationDiagnostics = {
    from: Date;
    items: DeliveryLifecycleNotificationDiagnostic[];
    nextCursor: string | null;
    to: Date;
};

export type DeliveryLifecycleNotificationHealthFilters = Pick<
    DeliveryLifecycleNotificationDiagnosticsFilters,
    'channel' | 'from' | 'milestone' | 'now' | 'requestId' | 'sourceId' | 'to'
>;

export type DeliveryLifecycleNotificationHealthSeverity =
    | 'healthy'
    | 'warning'
    | 'critical';

export type DeliveryLifecycleNotificationChannelHealth = {
    channel: DeliveryLifecycleNotificationChannel;
    failureCount: number;
    failureRate: number;
    severity: DeliveryLifecycleNotificationHealthSeverity;
    terminalCount: number;
};

export type DeliveryLifecycleNotificationHealth = {
    alerts: {
        ambiguousEmailSending: boolean;
        retryExhausted: boolean;
        staleEligibleQueue: boolean;
        systemicFailure: boolean;
    };
    ambiguousEmailSendingCount: number;
    channels: DeliveryLifecycleNotificationChannelHealth[];
    from: Date;
    retryExhaustedCount: number;
    severity: DeliveryLifecycleNotificationHealthSeverity;
    staleEligibleQueueCount: number;
    to: Date;
};

type DiagnosticCursor = {
    occurredAt: Date;
    recordId: string;
};

function boundedOpaqueIdentifier(value: string, field: string) {
    if (
        value.length === 0 ||
        value.length > 128 ||
        !/^[A-Za-z0-9][A-Za-z0-9._:~-]*$/u.test(value)
    ) {
        throw new Error(`${field} must be a bounded opaque identifier.`);
    }
    return value;
}

function validDate(value: Date, field: string) {
    if (Number.isNaN(value.getTime())) {
        throw new Error(`${field} must be a valid date.`);
    }
    return value;
}

function normalizedWindow({
    defaultWindowMs,
    from,
    now = new Date(),
    to,
}: {
    defaultWindowMs: number;
    from?: Date;
    now?: Date;
    to?: Date;
}) {
    const upper = validDate(to ?? now, 'to');
    const lower = validDate(
        from ?? new Date(upper.getTime() - defaultWindowMs),
        'from',
    );
    const duration = upper.getTime() - lower.getTime();
    if (duration < 0) throw new Error('from must not be after to.');
    if (duration > maximumWindowMs) {
        throw new Error(
            'Delivery notification window must not exceed 180 days.',
        );
    }
    return { from: lower, to: upper };
}

function normalizedPageSize(value = defaultPageSize) {
    if (!Number.isSafeInteger(value) || value < 1) return defaultPageSize;
    return Math.min(value, maximumPageSize);
}

function encodeCursor(cursor: DiagnosticCursor) {
    return Buffer.from(
        JSON.stringify({
            occurredAt: cursor.occurredAt.toISOString(),
            recordId: cursor.recordId,
        }),
    ).toString('base64url');
}

function decodeCursor(value: string): DiagnosticCursor {
    try {
        const parsed = JSON.parse(
            Buffer.from(value, 'base64url').toString('utf8'),
        ) as unknown;
        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            !('occurredAt' in parsed) ||
            typeof parsed.occurredAt !== 'string' ||
            !('recordId' in parsed) ||
            typeof parsed.recordId !== 'string' ||
            !/^[012]:\d{20}$/u.test(parsed.recordId)
        ) {
            throw new Error('invalid cursor');
        }
        const occurredAt = new Date(parsed.occurredAt);
        if (
            Number.isNaN(occurredAt.getTime()) ||
            occurredAt.toISOString() !== parsed.occurredAt
        ) {
            throw new Error('invalid cursor timestamp');
        }
        return { occurredAt, recordId: parsed.recordId };
    } catch {
        throw new Error('Delivery notification cursor is invalid.');
    }
}

const rawRequestIdExpression = sql<
    string | null
>`${notifications.metadata}->>'requestId'`;
const rawSourceIdExpression = sql<
    string | null
>`${notifications.metadata}->'source'->>'id'`;
const requestIdExpression = sql<string>`case
    when length(${rawRequestIdExpression}) between 1 and 128
      and ${rawRequestIdExpression} ~ '^[A-Za-z0-9][A-Za-z0-9._:~-]*$'
        then ${rawRequestIdExpression}
    else null
end`;
const sourceIdExpression = sql<string | null>`case
    when length(${rawSourceIdExpression}) between 1 and 128
      and ${rawSourceIdExpression} ~ '^[A-Za-z0-9][A-Za-z0-9._:~-]*$'
        then ${rawSourceIdExpression}
    else null
end`;
const milestoneExpression = sql<DeliveryLifecycleNotificationMilestone>`${notifications.metadata}->>'milestone'`;
const rawOccurredAtExpression =
    sql<Date>`coalesce(${notificationDeliveryEvents.occurredAt}, ${notificationDeliveryAttempts.attemptedAt})`.mapWith(
        notificationDeliveryAttempts.attemptedAt,
    );
const occurredAtExpression =
    sql<Date>`date_trunc('milliseconds', ${rawOccurredAtExpression})`.mapWith(
        notificationDeliveryAttempts.attemptedAt,
    );
const recordIdExpression = sql<string>`case
    when ${notificationDeliveryEvents.id} is null
        then '0:' || lpad(${notificationDeliveryAttempts.id}::text, 20, '0')
    else '1:' || lpad(${notificationDeliveryEvents.id}::text, 20, '0')
end`;
const decisionRequestIdExpression = sql<string>`case
    when length(${events.aggregateId}) between 1 and 128
      and ${events.aggregateId} ~ '^[A-Za-z0-9][A-Za-z0-9._:~-]*$'
        then ${events.aggregateId}
    else null
end`;
const rawDecisionSourceIdExpression = sql<
    string | null
>`${events.data}->>'sourceId'`;
const decisionSourceIdExpression = sql<string>`case
    when length(${rawDecisionSourceIdExpression}) between 1 and 128
      and ${rawDecisionSourceIdExpression} ~ '^[A-Za-z0-9][A-Za-z0-9._:~-]*$'
        then ${rawDecisionSourceIdExpression}
    else null
end`;
const decisionMilestoneExpression = sql<DeliveryLifecycleNotificationMilestone>`${events.data}->>'milestone'`;
const decisionReasonExpression = sql<DeliveryLifecycleNotificationReasonCode>`case
    when ${events.data}->>'reason' in (
        'idempotency_reused',
        'eta_threshold_already_emitted'
    ) then ${events.data}->>'reason'
    else 'unknown'
end`;
const decisionRecordIdExpression = sql<string>`'2:' || lpad(${events.id}::text, 20, '0')`;
const decisionOccurredAtExpression =
    sql<Date>`date_trunc('milliseconds', ${events.createdAt})`.mapWith(
        events.createdAt,
    );

function outcomeExpression() {
    return sql<DeliveryLifecycleNotificationOutcome>`case
        when ${notificationDeliveryEvents.type} = 'queued'
          and (
              ${notificationDeliveryEvents.metadata}->>'reason' = 'quiet_hours'
              or (
                  ${notificationDeliveryEvents.metadata}->>'reason' is null
                  and ${notificationDeliveryAttempts.providerResponseCode} = 'quiet_hours'
              )
          ) then 'deferred'
        when ${notificationDeliveryEvents.type} = 'failed'
          and ${notificationDeliveryEvents.metadata}->>'reason' in (${sql.join(
              intentionalSuppressionReasonCodes.map((reason) => sql`${reason}`),
              sql`, `,
          )}) then 'suppressed'
        when ${notificationDeliveryEvents.type} = 'failed'
          and coalesce(
              ${notificationDeliveryEvents.metadata}->>'willRetry',
              ${notificationDeliveryEvents.metadata}->>'retryable'
          ) = 'true' then 'retrying'
        when ${notificationDeliveryEvents.type} is not null
            then ${notificationDeliveryEvents.type}::text
        when ${notificationDeliveryAttempts.providerResponseCode} = 'quiet_hours'
            then 'deferred'
        when ${notificationDeliveryAttempts.status} = 'dropped'
          and (
              ${notificationDeliveryAttempts.provider} = 'router'
              or ${notificationDeliveryAttempts.providerResponseCode} in (
                  ${sql.join(
                      intentionalSuppressionReasonCodes.map(
                          (reason) => sql`${reason}`,
                      ),
                      sql`, `,
                  )}
              )
          ) then 'suppressed'
        when ${notificationDeliveryAttempts.status} = 'dropped' then 'failed'
        else ${notificationDeliveryAttempts.status}::text
    end`;
}

function providerExpression() {
    return sql<DeliveryLifecycleNotificationProvider>`case
        when ${notificationDeliveryAttempts.provider} = 'router' then 'router'
        when ${notificationDeliveryAttempts.provider} in (
            'delivery_lifecycle_email', 'email', 'acs'
        ) then 'email'
        when ${notificationDeliveryAttempts.provider} in (
            'web_push', 'web_push_queue'
        ) then 'push'
        else 'unknown'
    end`;
}

const safeReasonCodes = [
    'attempts_exhausted',
    'claim_expired_before_send',
    'claimed',
    'digest_daily',
    'digest_hourly',
    'digest_weekly',
    'eligible_after_quiet_hours',
    'eligible_immediate',
    'invalid_payload',
    'invalid_recipient',
    'missing_push_subscription',
    'not_recipient',
    'notification_expired',
    'notification_missing',
    'preference_disabled',
    'provider_rejected',
    'queued_background',
    'quiet_hours',
    'required_notification',
    'sender_failed',
    'sending',
    'sent',
] as const satisfies readonly Exclude<
    DeliveryLifecycleNotificationReasonCode,
    'unknown'
>[];

function reasonCodeExpression() {
    return sql<DeliveryLifecycleNotificationReasonCode>`case
        when ${notificationDeliveryEvents.metadata}->>'reason' in (${sql.join(
            safeReasonCodes.map((reason) => sql`${reason}`),
            sql`, `,
        )}) then ${notificationDeliveryEvents.metadata}->>'reason'
        when ${notificationDeliveryAttempts.providerResponseCode} in (${sql.join(
            safeReasonCodes.map((reason) => sql`${reason}`),
            sql`, `,
        )}) then ${notificationDeliveryAttempts.providerResponseCode}
        else 'unknown'
    end`;
}

function timestampParameter(value: Date) {
    return sql`${value.toISOString()}::timestamp`;
}

function diagnosticWhere({
    channel,
    cursor,
    from,
    milestone,
    outcome,
    requestId,
    sourceId,
    to,
}: {
    channel?: DeliveryLifecycleNotificationChannel;
    cursor?: DiagnosticCursor;
    from: Date;
    milestone?: DeliveryLifecycleNotificationMilestone;
    outcome?: DeliveryLifecycleNotificationOutcome;
    requestId?: string;
    sourceId?: string;
    to: Date;
}) {
    return and(
        eq(notifications.category, 'delivery_updates'),
        eq(notifications.type, 'delivery_lifecycle'),
        sql`${requestIdExpression} is not null`,
        inArray(milestoneExpression, [...deliveryLifecycleMilestones]),
        gte(rawOccurredAtExpression, timestampParameter(from)),
        lte(rawOccurredAtExpression, timestampParameter(to)),
        requestId ? eq(requestIdExpression, requestId) : undefined,
        sourceId ? eq(sourceIdExpression, sourceId) : undefined,
        milestone ? eq(milestoneExpression, milestone) : undefined,
        channel ? eq(notificationDeliveryAttempts.channel, channel) : undefined,
        outcome ? eq(outcomeExpression(), outcome) : undefined,
        cursor
            ? or(
                  lt(
                      occurredAtExpression,
                      timestampParameter(cursor.occurredAt),
                  ),
                  and(
                      eq(
                          occurredAtExpression,
                          timestampParameter(cursor.occurredAt),
                      ),
                      lt(recordIdExpression, cursor.recordId),
                  ),
              )
            : undefined,
    );
}

function decisionDiagnosticWhere({
    cursor,
    from,
    milestone,
    outcome,
    requestId,
    sourceId,
    to,
}: {
    cursor?: DiagnosticCursor;
    from: Date;
    milestone?: DeliveryLifecycleNotificationMilestone;
    outcome?: DeliveryLifecycleNotificationOutcome;
    requestId?: string;
    sourceId?: string;
    to: Date;
}) {
    return and(
        eq(
            events.type,
            knownEventTypes.delivery.requestLifecycleNotificationDecision,
        ),
        eq(events.version, 1),
        eq(sql<string>`${events.data}->>'decision'`, 'suppressed'),
        sql`${decisionRequestIdExpression} is not null`,
        sql`${decisionSourceIdExpression} is not null`,
        inArray(decisionMilestoneExpression, [...deliveryLifecycleMilestones]),
        inArray(sql<string>`${events.data}->>'reason'`, [
            'idempotency_reused',
            'eta_threshold_already_emitted',
        ]),
        gte(events.createdAt, from),
        lte(events.createdAt, to),
        requestId ? eq(decisionRequestIdExpression, requestId) : undefined,
        sourceId ? eq(decisionSourceIdExpression, sourceId) : undefined,
        milestone ? eq(decisionMilestoneExpression, milestone) : undefined,
        outcome && outcome !== 'suppressed' ? sql`false` : undefined,
        cursor
            ? or(
                  lt(
                      decisionOccurredAtExpression,
                      timestampParameter(cursor.occurredAt),
                  ),
                  and(
                      eq(
                          decisionOccurredAtExpression,
                          timestampParameter(cursor.occurredAt),
                      ),
                      lt(decisionRecordIdExpression, cursor.recordId),
                  ),
              )
            : undefined,
    );
}

function compareDiagnosticsDescending(
    left: DeliveryLifecycleNotificationDiagnostic,
    right: DeliveryLifecycleNotificationDiagnostic,
) {
    const timestampDifference =
        right.occurredAt.getTime() - left.occurredAt.getTime();
    return timestampDifference || right.recordId.localeCompare(left.recordId);
}

export async function getDeliveryLifecycleNotificationDiagnostics(
    filters: DeliveryLifecycleNotificationDiagnosticsFilters = {},
): Promise<DeliveryLifecycleNotificationDiagnostics> {
    const window = normalizedWindow({
        defaultWindowMs: diagnosticDefaultWindowMs,
        from: filters.from,
        now: filters.now,
        to: filters.to,
    });
    const limit = normalizedPageSize(filters.limit);
    const requestId = filters.requestId
        ? boundedOpaqueIdentifier(filters.requestId, 'requestId')
        : undefined;
    const sourceId = filters.sourceId
        ? boundedOpaqueIdentifier(filters.sourceId, 'sourceId')
        : undefined;
    const cursor = filters.cursor ? decodeCursor(filters.cursor) : undefined;
    const [attemptRows, decisionRows] = await Promise.all([
        storage()
            .select({
                attemptId: notificationDeliveryAttempts.id,
                channel: notificationDeliveryAttempts.channel,
                kind: sql<'attempt'>`'attempt'`,
                milestone: milestoneExpression,
                notificationId: notifications.id,
                occurredAt: occurredAtExpression,
                outcome: outcomeExpression(),
                provider: providerExpression(),
                reasonCode: reasonCodeExpression(),
                recordId: recordIdExpression,
                requestId: requestIdExpression,
                sourceId: sourceIdExpression,
            })
            .from(notificationDeliveryAttempts)
            .innerJoin(
                notifications,
                eq(
                    notifications.id,
                    notificationDeliveryAttempts.notificationId,
                ),
            )
            .leftJoin(
                notificationDeliveryEvents,
                eq(
                    notificationDeliveryEvents.deliveryAttemptId,
                    notificationDeliveryAttempts.id,
                ),
            )
            .where(
                diagnosticWhere({
                    channel: filters.channel,
                    cursor,
                    from: window.from,
                    milestone: filters.milestone,
                    outcome: filters.outcome,
                    requestId,
                    sourceId,
                    to: window.to,
                }),
            )
            .orderBy(desc(occurredAtExpression), desc(recordIdExpression))
            .limit(limit + 1),
        filters.channel
            ? Promise.resolve([])
            : storage()
                  .select({
                      attemptId: sql<null>`null`,
                      channel: sql<null>`null`,
                      kind: sql<'decision'>`'decision'`,
                      milestone: decisionMilestoneExpression,
                      notificationId: sql<null>`null`,
                      occurredAt: decisionOccurredAtExpression,
                      outcome: sql<'suppressed'>`'suppressed'`,
                      provider: sql<'unknown'>`'unknown'`,
                      reasonCode: decisionReasonExpression,
                      recordId: decisionRecordIdExpression,
                      requestId: decisionRequestIdExpression,
                      sourceId: decisionSourceIdExpression,
                  })
                  .from(events)
                  .where(
                      decisionDiagnosticWhere({
                          cursor,
                          from: window.from,
                          milestone: filters.milestone,
                          outcome: filters.outcome,
                          requestId,
                          sourceId,
                          to: window.to,
                      }),
                  )
                  .orderBy(
                      desc(decisionOccurredAtExpression),
                      desc(decisionRecordIdExpression),
                  )
                  .limit(limit + 1),
    ]);
    const rows: DeliveryLifecycleNotificationDiagnostic[] = [
        ...attemptRows,
        ...decisionRows,
    ].sort(compareDiagnosticsDescending);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
        ...window,
        items: page,
        nextCursor:
            rows.length > limit && last
                ? encodeCursor({
                      occurredAt: last.occurredAt,
                      recordId: last.recordId,
                  })
                : null,
    };
}

function healthSeverity(terminalCount: number, failureCount: number) {
    const failureRate = terminalCount > 0 ? failureCount / terminalCount : 0;
    if (terminalCount >= 10 && failureCount >= 5 && failureRate >= 0.5) {
        return 'critical' as const;
    }
    if (terminalCount >= 10 && failureCount >= 3 && failureRate >= 0.25) {
        return 'warning' as const;
    }
    return 'healthy' as const;
}

function highestSeverity(
    values: DeliveryLifecycleNotificationHealthSeverity[],
) {
    if (values.includes('critical')) return 'critical' as const;
    if (values.includes('warning')) return 'warning' as const;
    return 'healthy' as const;
}

function healthBaseWhere({
    channel,
    attemptFrom,
    milestone,
    notificationFrom,
    requestId,
    sourceId,
    to,
}: {
    channel?: DeliveryLifecycleNotificationChannel;
    attemptFrom: Date;
    milestone?: DeliveryLifecycleNotificationMilestone;
    notificationFrom: Date;
    requestId?: string;
    sourceId?: string;
    to: Date;
}) {
    return and(
        eq(notifications.category, 'delivery_updates'),
        eq(notifications.type, 'delivery_lifecycle'),
        inArray(milestoneExpression, [...deliveryLifecycleMilestones]),
        gte(notifications.createdAt, notificationFrom),
        lte(notifications.createdAt, to),
        gte(notificationDeliveryAttempts.attemptedAt, attemptFrom),
        lte(notificationDeliveryAttempts.attemptedAt, to),
        requestId ? eq(requestIdExpression, requestId) : undefined,
        sourceId ? eq(sourceIdExpression, sourceId) : undefined,
        milestone ? eq(milestoneExpression, milestone) : undefined,
        channel ? eq(notificationDeliveryAttempts.channel, channel) : undefined,
    );
}

export async function getDeliveryLifecycleNotificationHealth(
    filters: DeliveryLifecycleNotificationHealthFilters = {},
): Promise<DeliveryLifecycleNotificationHealth> {
    const now = filters.now ?? new Date();
    const window = normalizedWindow({
        defaultWindowMs: healthDefaultWindowMs,
        from: filters.from,
        now,
        to: filters.to,
    });
    const requestId = filters.requestId
        ? boundedOpaqueIdentifier(filters.requestId, 'requestId')
        : undefined;
    const sourceId = filters.sourceId
        ? boundedOpaqueIdentifier(filters.sourceId, 'sourceId')
        : undefined;
    const common = {
        channel: filters.channel,
        milestone: filters.milestone,
        requestId,
        sourceId,
    };
    const notificationLookbackMs =
        deliveryLifecycleNotificationMaximumAgeSeconds * 1000;
    const notificationWindowFrom = new Date(
        window.from.getTime() - notificationLookbackMs,
    );
    const terminalFailureCondition = or(
        eq(notificationDeliveryAttempts.status, 'failed'),
        and(
            eq(notificationDeliveryAttempts.status, 'dropped'),
            inArray(notificationDeliveryAttempts.providerResponseCode, [
                'invalid_payload',
                'provider_rejected',
            ]),
        ),
    );
    const terminalCondition = and(
        ne(
            sql`coalesce(${notificationDeliveryAttempts.provider}, '')`,
            'router',
        ),
        or(
            inArray(notificationDeliveryAttempts.status, ['accepted', 'sent']),
            terminalFailureCondition,
        ),
    );
    const channelRows = await storage()
        .select({
            channel: notificationDeliveryAttempts.channel,
            failureCount: sql<number>`count(*) filter (where ${terminalCondition} and ${terminalFailureCondition})::int`,
            terminalCount: sql<number>`count(*) filter (where ${terminalCondition})::int`,
        })
        .from(notificationDeliveryAttempts)
        .innerJoin(
            notifications,
            eq(notifications.id, notificationDeliveryAttempts.notificationId),
        )
        .where(
            healthBaseWhere({
                ...common,
                attemptFrom: window.from,
                notificationFrom: notificationWindowFrom,
                to: window.to,
            }),
        )
        .groupBy(notificationDeliveryAttempts.channel);
    const channels = channelRows.map(
        ({ channel, failureCount, terminalCount }) => ({
            channel,
            failureCount,
            failureRate: terminalCount > 0 ? failureCount / terminalCount : 0,
            severity: healthSeverity(terminalCount, failureCount),
            terminalCount,
        }),
    );

    const backlogFrom = new Date(now.getTime() - notificationLookbackMs);
    const staleCutoff = new Date(now.getTime() - staleQueueAgeMs);
    const [backlog] = await storage()
        .select({
            ambiguousEmailSendingCount: sql<number>`count(*) filter (
                where ${notificationDeliveryAttempts.channel} = 'email'
                  and ${notificationDeliveryAttempts.provider} = 'delivery_lifecycle_email'
                  and ${notificationDeliveryAttempts.status} = 'queued'
                  and ${notificationDeliveryAttempts.providerResponseCode} = 'sending'
            )::int`,
            staleEligibleQueueCount: sql<number>`count(*) filter (
                where ${notificationDeliveryAttempts.status} = 'queued'
                  and coalesce(${notificationDeliveryAttempts.provider}, '') <> 'router'
                  and coalesce(${notificationDeliveryAttempts.providerResponseCode}, '') <> 'quiet_hours'
                  and coalesce(${notificationDeliveryAttempts.providerResponseCode}, '') <> 'sending'
            )::int`,
        })
        .from(notificationDeliveryAttempts)
        .innerJoin(
            notifications,
            eq(notifications.id, notificationDeliveryAttempts.notificationId),
        )
        .where(
            and(
                healthBaseWhere({
                    ...common,
                    attemptFrom: backlogFrom,
                    notificationFrom: backlogFrom,
                    to: staleCutoff,
                }),
                eq(notificationDeliveryAttempts.status, 'queued'),
            ),
        );

    const retryCandidateAttempts = storage()
        .select({ attemptId: notificationDeliveryAttempts.id })
        .from(notifications)
        .innerJoin(
            notificationDeliveryAttempts,
            eq(notificationDeliveryAttempts.notificationId, notifications.id),
        )
        .where(
            and(
                eq(notifications.category, 'delivery_updates'),
                eq(notifications.type, 'delivery_lifecycle'),
                gte(notifications.createdAt, notificationWindowFrom),
                lte(notifications.createdAt, window.to),
                inArray(milestoneExpression, [...deliveryLifecycleMilestones]),
                requestId ? eq(requestIdExpression, requestId) : undefined,
                sourceId ? eq(sourceIdExpression, sourceId) : undefined,
                filters.milestone
                    ? eq(milestoneExpression, filters.milestone)
                    : undefined,
                filters.channel
                    ? eq(notificationDeliveryAttempts.channel, filters.channel)
                    : undefined,
                eq(notificationDeliveryAttempts.channel, 'email'),
                eq(
                    notificationDeliveryAttempts.provider,
                    'delivery_lifecycle_email',
                ),
            ),
        )
        .as('delivery_lifecycle_retry_candidate_attempts');
    const retryExhaustedEvent = storage()
        .select({
            notificationId: notificationDeliveryEvents.notificationId,
        })
        .from(notificationDeliveryEvents)
        .where(
            and(
                eq(
                    notificationDeliveryEvents.deliveryAttemptId,
                    retryCandidateAttempts.attemptId,
                ),
                gte(notificationDeliveryEvents.occurredAt, window.from),
                lte(notificationDeliveryEvents.occurredAt, window.to),
                eq(notificationDeliveryEvents.type, 'failed'),
                eq(
                    sql<string>`${notificationDeliveryEvents.metadata}->>'reason'`,
                    'attempts_exhausted',
                ),
            ),
        )
        .limit(1)
        .as('delivery_lifecycle_retry_exhausted_event');
    const [retryExhausted] = await storage()
        .select({
            count: sql<number>`count(distinct ${retryExhaustedEvent.notificationId})::int`,
        })
        .from(retryCandidateAttempts)
        .innerJoinLateral(retryExhaustedEvent, sql`true`);

    const ambiguousEmailSendingCount = backlog?.ambiguousEmailSendingCount ?? 0;
    const staleEligibleQueueCount = backlog?.staleEligibleQueueCount ?? 0;
    const retryExhaustedCount = retryExhausted?.count ?? 0;
    const severity = highestSeverity(channels.map((row) => row.severity));
    return {
        alerts: {
            ambiguousEmailSending: ambiguousEmailSendingCount > 0,
            retryExhausted: retryExhaustedCount > 0,
            staleEligibleQueue: staleEligibleQueueCount >= 5,
            systemicFailure: severity !== 'healthy',
        },
        ambiguousEmailSendingCount,
        channels,
        ...window,
        retryExhaustedCount,
        severity,
        staleEligibleQueueCount,
    };
}
