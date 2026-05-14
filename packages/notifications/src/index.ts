import type { OperationData } from '@gredice/directory-types';
import { postMessage } from '@gredice/slack';
import {
    type DeliveryRequestState,
    getDeliveryRequest,
    getEntityFormatted,
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

interface PurchaseNotificationDetails {
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
        console.error('Failed to build operation context', {
            operationId,
            error,
        });
        return null;
    }
}

async function sendSlackMessage(channel: string | undefined, text: string) {
    const token = process.env.SLACK_BOT_TOKEN;
    const result = await postMessage({
        token,
        channel,
        text,
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
}

async function getSlackChannelId(
    key: NotificationSettingKey,
): Promise<string | undefined> {
    try {
        const setting = await getNotificationSetting(key);
        if (!setting || setting.enabled !== 'true') {
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
) {
    const context = await buildOperationContext(operationId);
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

    await sendSlackMessage(channel, lines.filter(Boolean).join('\n'));
}

export async function notifyDeliveryRequestEvent(
    requestId: string,
    type: DeliveryRequestEventType,
    options: DeliveryRequestEventOptions = {},
) {
    const request = await getDeliveryRequest(requestId);
    if (!request) {
        console.warn('Delivery request not found for Slack notification', {
            requestId,
        });
        return;
    }

    let operationContext: OperationContext | null = null;
    if (request.operationId) {
        operationContext = await buildOperationContext(request.operationId);
    }

    const channel = await getSlackChannelId(
        NotificationSettingKeys.SlackDeliveryChannel,
    );
    if (!channel) {
        console.debug('Skipping delivery Slack notification: missing channel', {
            requestId,
        });
        return;
    }

    const lines: (string | undefined)[] = [];
    if (type === 'created') {
        lines.push(':package: *Novi zahtjev za dostavu*');
    } else if (type === 'cancelled') {
        lines.push(':x: *Zahtjev za dostavu otkazan*');
    } else {
        lines.push(':package: *Ažuriran zahtjev za dostavu*');
    }

    lines.push(`• ID zahtjeva: ${request.id}`);
    if (operationContext?.operationName) {
        lines.push(`• Radnja: ${operationContext.operationName}`);
    }
    if (operationContext?.farmName) {
        lines.push(`• Farma: ${operationContext.farmName}`);
    }
    if (operationContext?.locationDescription) {
        lines.push(`• Lokacija: ${operationContext.locationDescription}`);
    }
    if (request.slot?.startAt) {
        lines.push(`• Termin: ${formatDateTime(request.slot.startAt)}`);
    }
    if (request.mode) {
        lines.push(
            `• Način: ${request.mode === 'delivery' ? 'Dostava' : 'Preuzimanje'}`,
        );
    }
    if (options.status ?? request.state) {
        lines.push(`• Status: ${(options.status ?? request.state).toString()}`);
    }
    if (options.reason) {
        lines.push(`• Razlog: ${options.reason}`);
    }
    if (options.note) {
        lines.push(`• Napomena: ${options.note}`);
    }

    await sendSlackMessage(channel, lines.filter(Boolean).join('\n'));
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

export async function notifyPurchase(details: PurchaseNotificationDetails) {
    const channel = await getSlackChannelId(
        NotificationSettingKeys.SlackShoppingChannel,
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

    await sendSlackMessage(channel, lines.filter(Boolean).join('\n'));
}
