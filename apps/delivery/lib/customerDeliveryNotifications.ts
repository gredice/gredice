import {
    createDeliveryLifecycleEvent,
    customerDeliveryLifecycleNotification,
    customerDeliveryLifecycleRecipientIdempotencyKey,
    type DeliveryLifecycleEvent,
    type DeliveryLifecycleMilestone,
    type DeliveryLifecycleSource,
    deliveryLifecycleThresholds,
} from '@gredice/notifications';
import {
    createNotification as createStorageNotification,
    type DeliveryRunExceptionOutcome,
    type DeliveryRunExceptionReason,
    getDeliveryAccountContacts as getStorageDeliveryAccountContacts,
    getDeliveryRequestOwners as getStorageDeliveryRequestOwners,
    isCustomerDeliveryNotificationRecipientRole,
} from '@gredice/storage';
import 'server-only';

export { customerDeliveryLifecycleNotification } from '@gredice/notifications';
export const customerDeliveryProgressEvaluationIntervalMs = 2 * 60 * 1000;

type CustomerDeliveryMilestoneInputBase = {
    accountId?: string;
    occurredAt: Date;
    requestId: string;
    retryAttempt: number;
    runId: string;
    source: DeliveryLifecycleSource;
    stopId: number;
};

export type CustomerDeliveryMilestoneInput =
    CustomerDeliveryMilestoneInputBase &
        (
            | {
                  exception?: never;
                  milestone: Exclude<DeliveryLifecycleMilestone, 'exception'>;
              }
            | {
                  exception: {
                      outcome: DeliveryRunExceptionOutcome;
                      reason: DeliveryRunExceptionReason;
                  };
                  milestone: 'exception';
              }
        );

export type CustomerDeliveryNotificationDependencies = {
    createNotification: typeof createStorageNotification;
    getDeliveryAccountContacts: typeof getStorageDeliveryAccountContacts;
    getDeliveryRequestOwners: typeof getStorageDeliveryRequestOwners;
};

const defaultCustomerDeliveryNotificationDependencies = {
    createNotification: createStorageNotification,
    getDeliveryAccountContacts: getStorageDeliveryAccountContacts,
    getDeliveryRequestOwners: getStorageDeliveryRequestOwners,
} satisfies CustomerDeliveryNotificationDependencies;

function customerDeliveryNotificationDependencies(
    overrides: Partial<CustomerDeliveryNotificationDependencies> = {},
): CustomerDeliveryNotificationDependencies {
    return {
        ...defaultCustomerDeliveryNotificationDependencies,
        ...overrides,
    };
}

export function customerDeliveryNotificationsEnabled(
    value = process.env.GREDICE_DELIVERY_NOTIFICATIONS_ENABLED,
) {
    return value?.trim().toLowerCase() === 'true';
}

export function customerDeliveryPickedUpStopIds(
    stops: ReadonlyArray<{
        id: number;
        releasedAt?: Date | null;
        state: string;
        runSlot?: { manifestId: string } | null;
    }>,
    manifestId: string,
) {
    return stops.flatMap((stop) =>
        stop.state === 'pending' &&
        !stop.releasedAt &&
        stop.runSlot?.manifestId === manifestId
            ? [stop.id]
            : [],
    );
}

export function customerDeliveryProgressStopIsEligible({
    manifestState,
    stopState,
}: {
    manifestState: string | null | undefined;
    stopState: string;
}) {
    return stopState === 'pending' && manifestState === 'confirmed';
}

export function customerDeliveryProgressMilestones({
    estimatedArrivalAt,
    estimatedTravelSeconds,
    estimateIsFresh,
    now,
    stopsAhead,
    windowEndAt,
}: {
    estimatedArrivalAt: Date | null;
    estimatedTravelSeconds: number | null;
    estimateIsFresh: boolean;
    now: Date;
    stopsAhead: number | null;
    windowEndAt: Date | null;
}): Extract<
    DeliveryLifecycleMilestone,
    'near-arrival' | 'next-stop' | 'delayed'
>[] {
    const milestones: Extract<
        DeliveryLifecycleMilestone,
        'near-arrival' | 'next-stop' | 'delayed'
    >[] = [];
    const etaSeconds = estimatedArrivalAt
        ? Math.floor((estimatedArrivalAt.getTime() - now.getTime()) / 1000)
        : null;
    const freshEtaIsNear =
        estimateIsFresh &&
        etaSeconds !== null &&
        etaSeconds >= 0 &&
        etaSeconds <= deliveryLifecycleThresholds.nearArrivalEnterSeconds;
    const currentLegIsNear =
        estimateIsFresh &&
        stopsAhead === 0 &&
        estimatedTravelSeconds !== null &&
        estimatedTravelSeconds >= 0 &&
        estimatedTravelSeconds <=
            deliveryLifecycleThresholds.nearArrivalEnterSeconds;
    if (freshEtaIsNear || currentLegIsNear) {
        milestones.push('near-arrival');
    }
    if (stopsAhead === 0) milestones.push('next-stop');
    const delayReferenceAt =
        estimateIsFresh && estimatedArrivalAt
            ? Math.max(now.getTime(), estimatedArrivalAt.getTime())
            : now.getTime();
    if (
        windowEndAt &&
        delayReferenceAt - windowEndAt.getTime() >=
            deliveryLifecycleThresholds.delayEnterSeconds * 1000
    ) {
        milestones.push('delayed');
    }
    return milestones;
}

export function shouldEvaluateCustomerDeliveryProgress({
    acceptedAt,
    previousAcceptedAt,
}: {
    acceptedAt: Date;
    previousAcceptedAt: Date | null;
}) {
    if (!previousAcceptedAt) return true;
    if (acceptedAt.getTime() <= previousAcceptedAt.getTime()) return false;
    return (
        Math.floor(
            acceptedAt.getTime() / customerDeliveryProgressEvaluationIntervalMs,
        ) !==
        Math.floor(
            previousAcceptedAt.getTime() /
                customerDeliveryProgressEvaluationIntervalMs,
        )
    );
}

async function deliveryLifecycleEvent(
    input: CustomerDeliveryMilestoneInput,
    dependencies: CustomerDeliveryNotificationDependencies,
): Promise<DeliveryLifecycleEvent | null> {
    const accountId =
        input.accountId ??
        (await dependencies.getDeliveryRequestOwners([input.requestId]))[0]
            ?.accountId;
    if (!accountId) return null;
    const context = {
        accountId,
        requestId: input.requestId,
        runId: input.runId,
        stopId: String(input.stopId),
    };
    const common = {
        context,
        occurredAt: input.occurredAt.toISOString(),
        retryAttempt: input.retryAttempt,
        source: input.source,
    };
    return input.milestone === 'exception'
        ? createDeliveryLifecycleEvent({
              ...common,
              exception: input.exception,
              milestone: input.milestone,
          })
        : createDeliveryLifecycleEvent({
              ...common,
              milestone: input.milestone,
          });
}

export async function publishCustomerDeliveryMilestone(
    input: CustomerDeliveryMilestoneInput,
    dependencyOverrides: Partial<CustomerDeliveryNotificationDependencies> = {},
) {
    if (!customerDeliveryNotificationsEnabled()) {
        return { outcome: 'disabled' as const };
    }
    const dependencies =
        customerDeliveryNotificationDependencies(dependencyOverrides);
    const event = await deliveryLifecycleEvent(input, dependencies);
    if (!event) return { outcome: 'owner-unavailable' as const };
    const contacts = await dependencies.getDeliveryAccountContacts([
        event.accountId,
    ]);
    return await publishCustomerDeliveryEventToRecipients(
        event,
        contacts
            .filter(
                (contact) =>
                    contact.accountId === event.accountId &&
                    isCustomerDeliveryNotificationRecipientRole(contact.role),
            )
            .map((contact) => contact.id),
        dependencies,
    );
}

async function publishCustomerDeliveryEventToRecipients(
    event: DeliveryLifecycleEvent,
    recipientUserIds: readonly string[],
    dependencies: CustomerDeliveryNotificationDependencies,
) {
    const recipients = Array.from(new Set(recipientUserIds)).sort();
    if (recipients.length === 0) {
        return { outcome: 'recipient-unavailable' as const };
    }
    const notificationIds: string[] = [];
    const concurrency = 5;
    const now = new Date();
    for (let index = 0; index < recipients.length; index += concurrency) {
        notificationIds.push(
            ...(await Promise.all(
                recipients.slice(index, index + concurrency).map(
                    async (userId) =>
                        await dependencies.createNotification(
                            customerDeliveryLifecycleNotification(
                                event,
                                userId,
                            ),
                            {
                                idempotencyKey:
                                    customerDeliveryLifecycleRecipientIdempotencyKey(
                                        event,
                                        userId,
                                    ),
                                now,
                            },
                        ),
                ),
            )),
        );
    }
    return {
        notificationId: notificationIds[0],
        notificationIds,
        outcome: 'published' as const,
    };
}

export async function publishCustomerDeliveryMilestonesSafely(
    inputs: readonly CustomerDeliveryMilestoneInput[],
    dependencyOverrides: Partial<CustomerDeliveryNotificationDependencies> = {},
) {
    if (!customerDeliveryNotificationsEnabled() || inputs.length === 0) {
        return [];
    }
    const dependencies =
        customerDeliveryNotificationDependencies(dependencyOverrides);
    let owners: Awaited<ReturnType<typeof getStorageDeliveryRequestOwners>>;
    try {
        owners = await dependencies.getDeliveryRequestOwners(
            inputs.map((input) => input.requestId),
        );
    } catch (error) {
        console.warn('Customer delivery milestone owner lookup failed', {
            errorName: error instanceof Error ? error.name : 'Unknown',
            milestoneCount: inputs.length,
        });
        return inputs.map(() => ({ outcome: 'failed' as const }));
    }
    const accountIdByRequestId = new Map(
        owners.map((owner) => [owner.requestId, owner.accountId]),
    );
    let contacts: Awaited<ReturnType<typeof getStorageDeliveryAccountContacts>>;
    try {
        contacts = await dependencies.getDeliveryAccountContacts(
            Array.from(new Set(owners.map((owner) => owner.accountId))),
        );
    } catch (error) {
        console.warn('Customer delivery recipient lookup failed', {
            errorName: error instanceof Error ? error.name : 'Unknown',
            milestoneCount: inputs.length,
        });
        return inputs.map(() => ({ outcome: 'failed' as const }));
    }
    const recipientIdsByAccountId = new Map<string, string[]>();
    for (const contact of contacts) {
        if (!isCustomerDeliveryNotificationRecipientRole(contact.role)) {
            continue;
        }
        const recipients = recipientIdsByAccountId.get(contact.accountId) ?? [];
        recipients.push(contact.id);
        recipientIdsByAccountId.set(contact.accountId, recipients);
    }
    const results: Awaited<
        ReturnType<typeof publishCustomerDeliveryMilestoneSafely>
    >[] = [];
    const concurrency = 5;
    for (let index = 0; index < inputs.length; index += concurrency) {
        const batch = inputs.slice(index, index + concurrency);
        results.push(
            ...(await Promise.all(
                batch.map(async (input) => {
                    const accountId = accountIdByRequestId.get(input.requestId);
                    if (!accountId) {
                        return { outcome: 'owner-unavailable' as const };
                    }
                    try {
                        const event = await deliveryLifecycleEvent(
                            { ...input, accountId },
                            dependencies,
                        );
                        if (!event) {
                            return { outcome: 'owner-unavailable' as const };
                        }
                        return await publishCustomerDeliveryEventToRecipients(
                            event,
                            recipientIdsByAccountId.get(accountId) ?? [],
                            dependencies,
                        );
                    } catch (error) {
                        console.warn(
                            'Customer delivery milestone notification failed',
                            {
                                errorName:
                                    error instanceof Error
                                        ? error.name
                                        : 'Unknown',
                                milestone: input.milestone,
                                requestId: input.requestId,
                                runId: input.runId,
                                stopId: input.stopId,
                            },
                        );
                        return { outcome: 'failed' as const };
                    }
                }),
            )),
        );
    }
    return results;
}

export async function publishCustomerDeliveryMilestoneSafely(
    input: CustomerDeliveryMilestoneInput,
    dependencyOverrides: Partial<CustomerDeliveryNotificationDependencies> = {},
) {
    try {
        return await publishCustomerDeliveryMilestone(
            input,
            dependencyOverrides,
        );
    } catch (error) {
        console.warn('Customer delivery milestone notification failed', {
            errorName: error instanceof Error ? error.name : 'Unknown',
            milestone: input.milestone,
            requestId: input.requestId,
            runId: input.runId,
            stopId: input.stopId,
        });
        return { outcome: 'failed' as const };
    }
}
