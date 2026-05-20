import {
    createNotification,
    notificationDeliveryAttempts,
    notifications,
    recordNotificationDeliveryEvent,
    storage,
    webPushSubscriptions,
} from '@gredice/storage';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import webPush, {
    type PushSubscription,
    type SendResult,
    type Urgency,
} from 'web-push';
import { notificationRolloutFlags } from './notificationRollout';

const webPushQueueProvider = 'web_push_queue';
const defaultBatchLimit = 50;
const defaultMaxRetryFailures = 3;
const defaultTtlSeconds = 60 * 60 * 24;
const maxProviderBodyLength = 512;
const retryableStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);
const invalidSubscriptionStatusCodes = new Set([404, 410]);

export type WebPushVapidConfig = {
    subject: string;
    publicKey: string;
    privateKey: string;
};

export type QueuedWebPushAttempt = {
    accountId: string | null;
    actionLabel: string | null;
    actionUrl: string | null;
    attemptId: number;
    auth: string;
    category: string;
    collapseKey: string | null;
    content: string;
    endpoint: string;
    header: string;
    iconUrl: string | null;
    imageUrl: string | null;
    linkUrl: string | null;
    notificationId: string;
    p256dh: string;
    priority: string;
    pushSubscriptionId: string;
    safeImageUrl: string | null;
    safeLinkUrl: string | null;
    subscriptionFailCount: number;
    threadKey: string | null;
    ttlSeconds: number | null;
    urgency: string | null;
    userId: string | null;
};

export type WebPushSend = (
    attempt: QueuedWebPushAttempt,
) => Promise<SendResult | undefined>;

export type WebPushPayloadOptions = {
    richPushEnabled?: boolean;
};

export type WebPushAttemptRecorders = {
    accepted?: (
        attempt: QueuedWebPushAttempt,
        result: SendResult | undefined,
    ) => Promise<void>;
    failed?: (
        attempt: QueuedWebPushAttempt,
        failure: WebPushFailure,
    ) => Promise<void>;
};

export type WebPushFailure = {
    body: string | null;
    invalidSubscription: boolean;
    message: string;
    providerResponseCode: string;
    statusCode: number | null;
    willRetry: boolean;
};

export type WebPushBatchResult = {
    accepted: number;
    candidates: number;
    configured: boolean;
    failed: number;
    invalidated: number;
    retried: number;
    skipped: number;
};

export class WebPushDeliveryError extends Error {
    constructor(
        message: string,
        readonly statusCode: number | null = null,
        readonly body: string | null = null,
    ) {
        super(message);
        this.name = 'WebPushDeliveryError';
    }
}

function cleanEnv(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export function readWebPushVapidConfig(): WebPushVapidConfig | undefined {
    const subject = cleanEnv(process.env.GREDICE_WEB_PUSH_VAPID_SUBJECT);
    const publicKey = cleanEnv(process.env.GREDICE_WEB_PUSH_VAPID_PUBLIC_KEY);
    const privateKey = cleanEnv(process.env.GREDICE_WEB_PUSH_VAPID_PRIVATE_KEY);

    if (!subject || !publicKey || !privateKey) {
        return undefined;
    }

    return { privateKey, publicKey, subject };
}

function truncateProviderBody(body: string | null) {
    if (!body) return null;
    return body.slice(0, maxProviderBodyLength);
}

function normalizeUrgency(value: string | null): Urgency | undefined {
    switch (value) {
        case 'very-low':
        case 'low':
        case 'normal':
        case 'high':
            return value;
        default:
            return undefined;
    }
}

function webPushSubscription(attempt: QueuedWebPushAttempt): PushSubscription {
    return {
        endpoint: attempt.endpoint,
        keys: {
            auth: attempt.auth,
            p256dh: attempt.p256dh,
        },
    };
}

export function buildWebPushPayload(
    attempt: QueuedWebPushAttempt,
    options: WebPushPayloadOptions = {},
) {
    const richPushEnabled =
        options.richPushEnabled ?? notificationRolloutFlags.richPushEnabled;
    const url = attempt.safeLinkUrl ?? attempt.linkUrl ?? '/';
    const actionUrl = richPushEnabled ? attempt.actionUrl : null;
    return JSON.stringify({
        actions: actionUrl
            ? [
                  {
                      action: 'open',
                      title: attempt.actionLabel ?? 'Otvori',
                      url: actionUrl,
                  },
              ]
            : undefined,
        body: attempt.content,
        campaignId: undefined,
        category: attempt.category,
        deliveryAttemptId: attempt.attemptId,
        icon: attempt.iconUrl ?? '/icon.png',
        image: richPushEnabled
            ? (attempt.safeImageUrl ?? attempt.imageUrl ?? undefined)
            : undefined,
        notificationId: attempt.notificationId,
        requireInteraction:
            attempt.priority === 'critical' || attempt.priority === 'high',
        tag:
            attempt.threadKey ??
            attempt.collapseKey ??
            attempt.notificationId.slice(0, 64),
        title: attempt.header,
        url,
    });
}

export function createWebPushSend(
    config: WebPushVapidConfig,
    options: WebPushPayloadOptions = {},
): WebPushSend {
    webPush.setVapidDetails(
        config.subject,
        config.publicKey,
        config.privateKey,
    );

    return async (attempt) =>
        await webPush.sendNotification(
            webPushSubscription(attempt),
            buildWebPushPayload(attempt, options),
            {
                TTL: attempt.ttlSeconds ?? defaultTtlSeconds,
                urgency: normalizeUrgency(attempt.urgency),
            },
        );
}

function normalizeWebPushError(
    error: unknown,
    attempt: QueuedWebPushAttempt,
    maxRetryFailures: number,
): WebPushFailure {
    const statusCode =
        error instanceof WebPushDeliveryError
            ? error.statusCode
            : error instanceof webPush.WebPushError
              ? error.statusCode
              : null;
    const rawBody =
        error instanceof WebPushDeliveryError
            ? error.body
            : error instanceof webPush.WebPushError
              ? error.body
              : null;
    const message =
        error instanceof Error ? error.message : 'Unknown Web Push failure';
    const invalidSubscription =
        typeof statusCode === 'number' &&
        invalidSubscriptionStatusCodes.has(statusCode);
    const retryable =
        !invalidSubscription &&
        (statusCode === null || retryableStatusCodes.has(statusCode));
    const nextFailCount = attempt.subscriptionFailCount + 1;
    const willRetry = retryable && nextFailCount < maxRetryFailures;
    const providerResponseCode =
        statusCode === null
            ? willRetry
                ? 'retryable_network_error'
                : 'failed_network_error'
            : invalidSubscription
              ? `invalid_${statusCode}`
              : willRetry
                ? `retryable_${statusCode}`
                : `failed_${statusCode}`;

    return {
        body: truncateProviderBody(rawBody),
        invalidSubscription,
        message,
        providerResponseCode,
        statusCode,
        willRetry,
    };
}

async function recordAcceptedAttempt(
    attempt: QueuedWebPushAttempt,
    result: SendResult | undefined,
) {
    const now = new Date();
    const statusCode = result?.statusCode ?? 201;
    await storage()
        .update(notificationDeliveryAttempts)
        .set({
            acceptedAt: now,
            attemptedAt: now,
            failedAt: null,
            providerResponseBody: `statusCode=${statusCode}`,
            providerResponseCode: `accepted_${statusCode}`,
            status: 'accepted',
        })
        .where(eq(notificationDeliveryAttempts.id, attempt.attemptId));
    await storage()
        .update(webPushSubscriptions)
        .set({
            failCount: 0,
            lastFailureAt: null,
            lastFailureCode: null,
            lastFailureReason: null,
            lastSeenAt: now,
            lastSuccessAt: now,
            updatedAt: now,
        })
        .where(eq(webPushSubscriptions.id, attempt.pushSubscriptionId));
    await recordNotificationDeliveryEvent({
        deliveryAttemptId: attempt.attemptId,
        metadata: {
            provider: 'web_push',
            statusCode,
        },
        notificationId: attempt.notificationId,
        type: 'accepted',
    });
}

async function recordFailedAttempt(
    attempt: QueuedWebPushAttempt,
    failure: WebPushFailure,
) {
    const now = new Date();
    const subscriptionUpdate = {
        failCount: sql`${webPushSubscriptions.failCount} + 1`,
        lastFailureAt: now,
        lastFailureCode: failure.providerResponseCode,
        lastFailureReason: failure.message.slice(0, 512),
        updatedAt: now,
        ...(failure.invalidSubscription
            ? {
                  enabled: false,
                  revokedAt: now,
                  revokedReason: 'web_push_endpoint_invalid',
              }
            : {}),
    };

    await storage()
        .update(notificationDeliveryAttempts)
        .set({
            attemptedAt: now,
            failedAt: failure.willRetry ? null : now,
            providerResponseBody: failure.body,
            providerResponseCode: failure.providerResponseCode,
            status: failure.willRetry ? 'queued' : 'failed',
        })
        .where(eq(notificationDeliveryAttempts.id, attempt.attemptId));
    await storage()
        .update(webPushSubscriptions)
        .set(subscriptionUpdate)
        .where(eq(webPushSubscriptions.id, attempt.pushSubscriptionId));
    await recordNotificationDeliveryEvent({
        deliveryAttemptId: attempt.attemptId,
        metadata: {
            invalidSubscription: failure.invalidSubscription,
            provider: 'web_push',
            statusCode: failure.statusCode,
            willRetry: failure.willRetry,
        },
        notificationId: attempt.notificationId,
        type: 'failed',
    });
}

export async function processWebPushAttempts({
    attempts,
    maxRetryFailures = defaultMaxRetryFailures,
    recorders,
    send,
}: {
    attempts: QueuedWebPushAttempt[];
    maxRetryFailures?: number;
    recorders?: WebPushAttemptRecorders;
    send: WebPushSend;
}): Promise<WebPushBatchResult> {
    const result: WebPushBatchResult = {
        accepted: 0,
        candidates: attempts.length,
        configured: true,
        failed: 0,
        invalidated: 0,
        retried: 0,
        skipped: 0,
    };

    for (const attempt of attempts) {
        try {
            const sendResult = await send(attempt);
            await (recorders?.accepted ?? recordAcceptedAttempt)(
                attempt,
                sendResult,
            );
            result.accepted += 1;
        } catch (error) {
            const failure = normalizeWebPushError(
                error,
                attempt,
                maxRetryFailures,
            );
            await (recorders?.failed ?? recordFailedAttempt)(attempt, failure);
            if (failure.invalidSubscription) {
                result.invalidated += 1;
                result.failed += 1;
            } else if (failure.willRetry) {
                result.retried += 1;
            } else {
                result.failed += 1;
            }
            console.warn('Web Push delivery failed', {
                attemptId: attempt.attemptId,
                invalidSubscription: failure.invalidSubscription,
                notificationId: attempt.notificationId,
                providerResponseCode: failure.providerResponseCode,
                pushSubscriptionId: attempt.pushSubscriptionId,
                statusCode: failure.statusCode,
                willRetry: failure.willRetry,
            });
        }
    }

    return result;
}

export async function getQueuedWebPushAttempts({
    limit = defaultBatchLimit,
    notificationId,
}: {
    limit?: number;
    notificationId?: string;
} = {}): Promise<QueuedWebPushAttempt[]> {
    return await storage()
        .select({
            accountId: notificationDeliveryAttempts.accountId,
            actionLabel: notifications.actionLabel,
            actionUrl: notifications.actionUrl,
            attemptId: notificationDeliveryAttempts.id,
            auth: webPushSubscriptions.auth,
            category: notifications.category,
            collapseKey: notifications.collapseKey,
            content: notifications.content,
            endpoint: webPushSubscriptions.endpoint,
            header: notifications.header,
            iconUrl: notifications.iconUrl,
            imageUrl: notifications.imageUrl,
            linkUrl: notifications.linkUrl,
            notificationId: notifications.id,
            p256dh: webPushSubscriptions.p256dh,
            priority: notifications.priority,
            pushSubscriptionId: webPushSubscriptions.id,
            safeImageUrl: notifications.safeImageUrl,
            safeLinkUrl: notifications.safeLinkUrl,
            subscriptionFailCount: webPushSubscriptions.failCount,
            threadKey: notifications.threadKey,
            ttlSeconds: notifications.ttlSeconds,
            urgency: notifications.urgency,
            userId: notificationDeliveryAttempts.userId,
        })
        .from(notificationDeliveryAttempts)
        .innerJoin(
            notifications,
            eq(notificationDeliveryAttempts.notificationId, notifications.id),
        )
        .innerJoin(
            webPushSubscriptions,
            eq(
                notificationDeliveryAttempts.pushSubscriptionId,
                webPushSubscriptions.id,
            ),
        )
        .where(
            and(
                eq(notificationDeliveryAttempts.channel, 'push'),
                eq(notificationDeliveryAttempts.provider, webPushQueueProvider),
                eq(notificationDeliveryAttempts.status, 'queued'),
                notificationId
                    ? eq(
                          notificationDeliveryAttempts.notificationId,
                          notificationId,
                      )
                    : undefined,
                eq(webPushSubscriptions.enabled, true),
                eq(webPushSubscriptions.permissionState, 'granted'),
                isNull(webPushSubscriptions.revokedAt),
            ),
        )
        .orderBy(asc(notificationDeliveryAttempts.createdAt))
        .limit(Math.max(1, Math.min(limit, 500)));
}

export async function sendQueuedWebPushAttempts({
    limit = defaultBatchLimit,
    maxRetryFailures = defaultMaxRetryFailures,
    notificationId,
    richPushEnabled,
    send,
}: {
    limit?: number;
    maxRetryFailures?: number;
    notificationId?: string;
    richPushEnabled?: boolean;
    send?: WebPushSend;
} = {}): Promise<WebPushBatchResult> {
    const config = readWebPushVapidConfig();
    const attempts = await getQueuedWebPushAttempts({ limit, notificationId });

    if (!config && !send) {
        return {
            accepted: 0,
            candidates: attempts.length,
            configured: false,
            failed: 0,
            invalidated: 0,
            retried: 0,
            skipped: attempts.length,
        };
    }

    if (attempts.length === 0) {
        return {
            accepted: 0,
            candidates: 0,
            configured: true,
            failed: 0,
            invalidated: 0,
            retried: 0,
            skipped: 0,
        };
    }

    const resolvedSend =
        send ??
        (config
            ? createWebPushSend(config, {
                  richPushEnabled,
              })
            : undefined);
    if (!resolvedSend) {
        return {
            accepted: 0,
            candidates: attempts.length,
            configured: false,
            failed: 0,
            invalidated: 0,
            retried: 0,
            skipped: attempts.length,
        };
    }

    return await processWebPushAttempts({
        attempts,
        maxRetryFailures,
        send: resolvedSend,
    });
}

export async function createAndSendTestWebPushNotification({
    accountId,
    createNotificationForTest = createNotification,
    sendQueued = sendQueuedWebPushAttempts,
    userId,
}: {
    accountId: string;
    createNotificationForTest?: typeof createNotification;
    sendQueued?: typeof sendQueuedWebPushAttempts;
    userId: string;
}) {
    const notificationId = await createNotificationForTest({
        accountId,
        category: 'test',
        content: 'Ovo je testna Web Push obavijest s Gredica.',
        header: 'Test obavijest',
        linkUrl: '/',
        primaryChannel: 'push',
        priority: 'normal',
        timestamp: new Date(),
        type: 'test',
        userId,
    });
    const delivery = await sendQueued({
        limit: 10,
        notificationId,
    });

    return {
        ...delivery,
        notificationId,
        targeted: delivery.candidates,
    };
}
