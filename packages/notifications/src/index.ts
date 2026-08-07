import type { OperationData } from '@gredice/directory-types';
import { postMessage } from '@gredice/slack';
import {
    createNotification,
    type DeliveryRequestState,
    getDeliveryRequest,
    getEntityFormatted,
    getFarm,
    getGarden,
    getNotificationSetting,
    getOperationById,
    getRaisedBed,
    getUser,
    IntegrationTypes,
    type NotificationSettingKey,
    NotificationSettingKeys,
    type OperationCancelPayload,
    type OperationCompletePayload,
    type OperationSchedulePayload,
} from '@gredice/storage';
import {
    buildDeliverySlackNotificationMessage,
    type DeliverySlackNotificationItem,
} from './deliverySlackNotificationMessage';

export * from './customerDeliveryNotifications';
export * from './deliveryLifecycle';

type OperationEventType =
    | 'scheduled'
    | 'rescheduled'
    | 'approved'
    | 'completed'
    | 'canceled';

export type DeliveryRequestEventType = 'created' | 'updated' | 'cancelled';

interface DeliveryRequestEventOptions {
    reason?: string | null;
    note?: string | null;
    status?: DeliveryRequestState | string | null;
}

export interface PurchaseNotificationDetails {
    accountId?: string | null;
    amountTotal?: number | null;
    currency?: string | null;
    checkoutSessionId?: string | null;
    customerEmail?: string | null;
    items?: {
        name?: string | null;
        quantity?: number | null;
        amountSubtotal?: number | null;
    }[];
}

export type CheckoutFulfillmentIncidentDetails = {
    accountId: string;
    cartItemId: number;
    checkoutSessionId: string;
    incidentId: string;
    positionIndex: number;
    raisedBedId: number;
};

interface OperationContext {
    operationName: string;
    farmName?: string;
    farmId?: number;
    farmSlackChannelId?: string | null;
    locationDescription?: string;
    scheduledDate?: Date;
}

function formatDateTime(value?: Date | string | null) {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function formatCurrency(amountCents?: number | null, currency?: string | null) {
    if (typeof amountCents !== 'number') return undefined;
    const currencyCode = currency?.toUpperCase() || 'EUR';
    try {
        return new Intl.NumberFormat('hr-HR', {
            style: 'currency',
            currency: currencyCode,
        }).format(amountCents / 100);
    } catch {
        return `${(amountCents / 100).toFixed(2)} ${currencyCode}`;
    }
}

async function buildOperationContext(
    operationId: number,
    throwOnLookupError = false,
): Promise<OperationContext | null> {
    try {
        const operation = await getOperationById(operationId);
        const entity = await getEntityFormatted<OperationData>(
            operation.entityId,
        );
        const operationName =
            entity?.information?.label || `Operacija #${operationId}`;

        let farmName: string | undefined;
        let farmId: number | undefined;
        let farmSlackChannelId: string | null | undefined;
        const locationParts: string[] = [];

        if (operation.gardenId) {
            const garden = await getGarden(operation.gardenId);
            if (garden) {
                if (garden.name) {
                    locationParts.push(`vrt ${garden.name}`);
                }
                if (garden.farm) {
                    farmName = garden.farm.name ?? farmName;
                    farmId = garden.farm.id ?? farmId;
                    farmSlackChannelId =
                        (garden.farm as { slackChannelId?: string | null })
                            .slackChannelId ?? farmSlackChannelId;
                }
            }
        }

        if (operation.raisedBedId) {
            const raisedBed = await getRaisedBed(operation.raisedBedId);
            if (raisedBed) {
                if (raisedBed.name) {
                    locationParts.push(`gredica ${raisedBed.name}`);
                }
                if (
                    typeof operation.raisedBedFieldId === 'number' &&
                    Array.isArray(raisedBed.fields)
                ) {
                    const field = raisedBed.fields.find(
                        (candidate) =>
                            candidate.id === operation.raisedBedFieldId,
                    );
                    if (field && typeof field.positionIndex === 'number') {
                        locationParts.push(`polje ${field.positionIndex + 1}`);
                    }
                }
                if (raisedBed.gardenId) {
                    const garden = await getGarden(raisedBed.gardenId);
                    if (garden) {
                        if (
                            garden.name &&
                            !locationParts.some((part) =>
                                part.startsWith('vrt '),
                            )
                        ) {
                            locationParts.unshift(`vrt ${garden.name}`);
                        }
                        if (garden.farm) {
                            farmName = garden.farm.name ?? farmName;
                            farmId = garden.farm.id ?? farmId;
                            farmSlackChannelId =
                                (
                                    garden.farm as {
                                        slackChannelId?: string | null;
                                    }
                                ).slackChannelId ?? farmSlackChannelId;
                        }
                    }
                }
            }
        }

        if (operation.farmId && !farmSlackChannelId) {
            const farm = await getFarm(operation.farmId);
            if (farm) {
                farmName = farm.name ?? farmName;
                farmId = farm.id;
                farmSlackChannelId = farm.slackChannelId ?? farmSlackChannelId;
            }
        }

        const locationDescription =
            locationParts.length > 0
                ? Array.from(new Set(locationParts)).join(' · ')
                : undefined;

        return {
            operationName,
            farmName,
            farmId,
            farmSlackChannelId,
            locationDescription,
            scheduledDate: operation.scheduledDate || undefined,
        };
    } catch (error) {
        if (throwOnLookupError) throw error;
        console.error('Failed to build operation context', {
            operationId,
            error,
        });
        return null;
    }
}

export type SlackNotificationDeliveryOptions = {
    abortSignal?: AbortSignal;
    beforeProviderSubmission?: () => Promise<void>;
    throwOnLookupError?: boolean;
};

async function sendSlackMessage(
    channel: string | undefined,
    text: string,
    {
        abortSignal,
        beforeProviderSubmission,
    }: SlackNotificationDeliveryOptions = {},
) {
    const token = process.env.SLACK_BOT_TOKEN;
    const result = await postMessage({
        token,
        channel,
        text,
        abortSignal,
        beforeProviderSubmission,
    });
    if (!result.ok) {
        if (result.skipped) {
            console.debug('Slack notification skipped', {
                reason: result.skipped,
            });
        } else {
            console.error('Failed to send Slack notification', result);
        }
    }
    return result;
}

async function getSlackChannelId(
    key: NotificationSettingKey,
    throwOnLookupError = false,
): Promise<string | undefined> {
    try {
        const setting = await getNotificationSetting(key);
        if (setting?.enabled !== 'true') {
            return undefined;
        }

        // Type guard to check if config is SlackConfig
        if (
            setting.integrationType === IntegrationTypes.Slack &&
            typeof setting.config === 'object' &&
            setting.config !== null &&
            'channelId' in setting.config
        ) {
            return setting.config.channelId;
        }

        return undefined;
    } catch (error) {
        if (throwOnLookupError) throw error;
        console.error('Failed to load Slack notification setting', {
            key,
            error,
        });
        return undefined;
    }
}

export async function notifyOperationUpdate(
    operationId: number,
    type: OperationEventType,
    options?:
        | OperationCompletePayload
        | OperationSchedulePayload
        | OperationCancelPayload,
): Promise<void> {
    await deliverOperationSlackNotification(operationId, type, options);
}

export async function deliverOperationSlackNotification(
    operationId: number,
    type: OperationEventType,
    options:
        | OperationCompletePayload
        | OperationSchedulePayload
        | OperationCancelPayload
        | undefined,
    deliveryOptions: SlackNotificationDeliveryOptions = {},
) {
    const context = await buildOperationContext(
        operationId,
        deliveryOptions.throwOnLookupError,
    );
    if (!context) {
        return;
    }

    const channel = context.farmSlackChannelId ?? undefined;
    if (!channel) {
        console.debug(
            'Skipping operation Slack notification: missing channel',
            {
                operationId,
                farmId: context.farmId,
            },
        );
        return;
    }

    const formattedScheduledDate = formatDateTime(
        (options && 'scheduledDate' in options
            ? options.scheduledDate
            : undefined) ?? context.scheduledDate,
    );

    const lines: (string | undefined)[] = [];
    switch (type) {
        case 'scheduled':
            lines.push(`:calendar: *${context.operationName}*`);
            if (formattedScheduledDate) {
                lines.push(`• Zakazano: ${formattedScheduledDate}`);
            }
            break;
        case 'rescheduled':
            lines.push(`:arrows_clockwise: *${context.operationName}*`);
            if (formattedScheduledDate) {
                lines.push(`• Novi termin: ${formattedScheduledDate}`);
            }
            break;
        case 'approved':
            lines.push(`:white_check_mark: *${context.operationName}*`);
            lines.push('• Status: odobreno');
            break;
        case 'completed':
            lines.push(`:seedling: *${context.operationName}*`);
            lines.push('• Status: dovršeno');
            if (options && 'completedBy' in options && options.completedBy) {
                lines.push(`• Izvršio: ${options.completedBy}`);
            }
            break;
        case 'canceled':
            lines.push(`:x: *${context.operationName}*`);
            lines.push('• Status: otkazano');
            if (options && 'reason' in options && options.reason) {
                lines.push(`• Razlog: ${options.reason}`);
            }
            break;
        default:
            lines.push(`*${context.operationName}*`);
    }

    if (context.farmName) {
        lines.push(`• Farma: ${context.farmName}`);
    }
    if (context.locationDescription) {
        lines.push(`• Lokacija: ${context.locationDescription}`);
    }
    lines.push(`• ID radnje: ${operationId}`);

    return await sendSlackMessage(
        channel,
        lines.filter(Boolean).join('\n'),
        deliveryOptions,
    );
}

export async function notifyDeliveryRequestEvent(
    requestId: string,
    type: DeliveryRequestEventType,
    options?: DeliveryRequestEventOptions,
): Promise<void> {
    await deliverDeliveryRequestSlackNotification(requestId, type, options);
}

export async function notifyDeliveryRequestGroupEvent(
    requestIds: string[],
    type: DeliveryRequestEventType,
    options?: DeliveryRequestEventOptions,
): Promise<void> {
    await deliverDeliveryRequestGroupSlackNotification(
        requestIds,
        type,
        options,
    );
}

export async function deliverDeliveryRequestSlackNotification(
    requestId: string,
    type: DeliveryRequestEventType,
    options: DeliveryRequestEventOptions = {},
    deliveryOptions: SlackNotificationDeliveryOptions = {},
) {
    return await deliverDeliveryRequestGroupSlackNotification(
        [requestId],
        type,
        options,
        deliveryOptions,
    );
}

export async function deliverDeliveryRequestGroupSlackNotification(
    requestIds: string[],
    type: DeliveryRequestEventType,
    options: DeliveryRequestEventOptions = {},
    deliveryOptions: SlackNotificationDeliveryOptions = {},
) {
    const uniqueRequestIds = Array.from(new Set(requestIds));
    if (uniqueRequestIds.length === 0) {
        return;
    }

    const channel = await getSlackChannelId(
        NotificationSettingKeys.SlackDeliveryChannel,
        deliveryOptions.throwOnLookupError,
    );
    if (!channel) {
        console.debug('Skipping delivery Slack notification: missing channel', {
            requestIds: uniqueRequestIds,
        });
        return;
    }

    const items: DeliverySlackNotificationItem[] = [];
    for (const requestId of uniqueRequestIds) {
        const request = await getDeliveryRequest(requestId);
        if (!request) {
            console.warn('Delivery request not found for Slack notification', {
                requestId,
            });
            continue;
        }

        const operationContext = request.operationId
            ? await buildOperationContext(
                  request.operationId,
                  deliveryOptions.throwOnLookupError,
              )
            : null;
        items.push({
            id: request.id,
            operationName: operationContext?.operationName,
            farmName: operationContext?.farmName,
            locationDescription: operationContext?.locationDescription,
            slotStartAt: request.slot?.startAt,
            mode: request.mode,
            status: request.state,
        });
    }

    const message = buildDeliverySlackNotificationMessage(items, type, options);
    if (!message) return;

    return await sendSlackMessage(channel, message, deliveryOptions);
}

export async function notifyNewUserRegistered(userId: string) {
    const channel = await getSlackChannelId(
        NotificationSettingKeys.SlackNewUsersChannel,
    );
    if (!channel) {
        console.debug('Skipping new user Slack notification: missing channel');
        return;
    }

    const user = await getUser(userId);
    if (!user) {
        console.warn('User not found for Slack new user notification', {
            userId,
        });
        return;
    }

    const primaryAccountId = user.accounts?.[0]?.accountId;

    const lines: (string | undefined)[] = [
        ':wave: *Novi korisnik*',
        user.displayName ? `• Ime: ${user.displayName}` : undefined,
        user.userName ? `• Email: ${user.userName}` : undefined,
        primaryAccountId ? `• Račun: ${primaryAccountId}` : undefined,
        `• ID korisnika: ${user.id}`,
    ];

    await sendSlackMessage(channel, lines.filter(Boolean).join('\n'));
}

export async function notifyOperationAssignedUsers(
    operationId: number,
    assignedUserIds: string[],
) {
    const uniqueUserIds = Array.from(
        new Set(assignedUserIds.filter((id) => id && id.length > 0)),
    );
    if (uniqueUserIds.length === 0) {
        return;
    }

    const context = await buildOperationContext(operationId);
    const operationName = context?.operationName ?? `Radnja #${operationId}`;
    const formattedScheduledDate = formatDateTime(context?.scheduledDate);

    const header = 'Nova radnja je dodijeljena';
    const locationLine = context?.locationDescription
        ? ` (${context.locationDescription})`
        : '';
    const scheduleLine = formattedScheduledDate
        ? ` Termin: ${formattedScheduledDate}.`
        : '';
    const content = `Dodijeljena ti je radnja **${operationName}**${locationLine}.${scheduleLine}`;

    await Promise.all(
        uniqueUserIds.map(async (userId) => {
            try {
                const user = await getUser(userId);
                const accountId = user?.accounts?.[0]?.accountId;
                if (!accountId) {
                    console.warn(
                        'Skipping operation assignment notification: no account for user',
                        { userId, operationId },
                    );
                    return;
                }

                await createNotification({
                    accountId,
                    userId,
                    header,
                    content,
                    category: 'garden',
                    type: 'operation_assigned',
                    primaryChannel: 'push',
                    priority: 'normal',
                    timestamp: new Date(),
                });
            } catch (error) {
                console.error(
                    'Failed to create operation assignment notification',
                    { userId, operationId, error },
                );
            }
        }),
    );
}

export async function notifyPurchase(details: PurchaseNotificationDetails) {
    await deliverPurchaseNotification(details);
}

export async function deliverPurchaseNotification(
    details: PurchaseNotificationDetails,
    deliveryOptions: SlackNotificationDeliveryOptions = {},
) {
    const channel = await getSlackChannelId(
        NotificationSettingKeys.SlackShoppingChannel,
        deliveryOptions.throwOnLookupError,
    );
    if (!channel) {
        console.debug('Skipping shopping Slack notification: missing channel');
        return;
    }

    const lines: (string | undefined)[] = [':shopping_trolley: *Nova kupnja*'];

    const amount = formatCurrency(details.amountTotal, details.currency);
    if (amount) {
        lines.push(`• Iznos: ${amount}`);
    }
    if (details.accountId) {
        lines.push(`• Račun: ${details.accountId}`);
    }
    if (details.customerEmail) {
        lines.push(`• Email: ${details.customerEmail}`);
    }
    if (details.checkoutSessionId) {
        lines.push(`• Checkout ID: ${details.checkoutSessionId}`);
    }
    if (Array.isArray(details.items) && details.items.length > 0) {
        const itemsText = details.items
            .slice(0, 5)
            .map((item) => {
                const quantity = item.quantity ?? 1;
                const name = item.name ?? 'Stavka';
                return `${quantity}× ${name}`;
            })
            .join(', ');
        lines.push(`• Stavke: ${itemsText}`);
        if (details.items.length > 5) {
            lines.push(`• +${details.items.length - 5} dodatnih stavki`);
        }
    }

    return await sendSlackMessage(
        channel,
        lines.filter(Boolean).join('\n'),
        deliveryOptions,
    );
}

export async function notifyCheckoutFulfillmentIncident(
    details: CheckoutFulfillmentIncidentDetails,
) {
    const channel = await getSlackChannelId(
        NotificationSettingKeys.SlackShoppingChannel,
    );
    if (!channel) {
        throw new Error(
            'Checkout fulfillment incident Slack notification requires the shopping channel.',
        );
    }

    const result = await sendSlackMessage(
        channel,
        [
            ':rotating_light: *Plaćena sadnja nije isporučena*',
            '• Potrebna je ručna provjera, postavljanje ili povrat sredstava.',
            `• Incident: ${details.incidentId}`,
            `• Checkout ID: ${details.checkoutSessionId}`,
            `• Stavka košarice: ${details.cartItemId.toString()}`,
            `• Račun: ${details.accountId}`,
            `• Gredica/polje: ${details.raisedBedId.toString()}/${(details.positionIndex + 1).toString()}`,
        ].join('\n'),
    );
    if (!result.ok) {
        throw new Error(
            `Checkout fulfillment incident Slack notification failed: ${result.error ?? result.skipped ?? 'unknown_error'}`,
        );
    }
}
