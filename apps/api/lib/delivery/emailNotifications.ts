import {
    buildDeliveryEmailDetails,
    type PendingDeliveryReadyEmailRequest,
} from '@gredice/storage';
import {
    sendDeliveryCancelled,
    sendDeliveryReady,
    sendDeliveryScheduled,
} from '../email/transactional';

// TODO: Move to shared location so env vars can be shared between services
const CUSTOMER_APP_URL =
    process.env.GREDICE_GARDEN_APP_URL ?? 'https://vrt.gredice.com';

async function sendDeliveryEmails(
    requestId: string,
    type: 'scheduled' | 'ready' | 'cancelled',
) {
    try {
        const details = await buildDeliveryEmailDetails(requestId);
        if (!details) {
            return false;
        }

        await Promise.all(
            details.recipients.map((recipient) => {
                const config = {
                    email: recipient,
                    deliveryWindow: details.deliveryWindow,
                    addressLine: details.addressLine,
                    contactName: details.contactName,
                    manageUrl: CUSTOMER_APP_URL,
                };

                if (type === 'scheduled') {
                    return sendDeliveryScheduled(recipient, config);
                }

                if (type === 'ready') {
                    return sendDeliveryReady(recipient, {
                        ...config,
                        readyItems: details.readyItem
                            ? [details.readyItem]
                            : undefined,
                    });
                }

                return sendDeliveryCancelled(recipient, config);
            }),
        );

        return true;
    } catch (error) {
        console.error('Failed to send delivery notification email', {
            requestId,
            type,
            error,
        });
        return false;
    }
}

interface DeliveryReadyEmailBatchGroup {
    key: string;
    readyEvents: {
        requestId: string;
        readyEventId: number;
    }[];
    recipients: string[];
    readyItems: string[];
    deliveryWindow: string;
    addressLine?: string;
    contactName?: string;
}

export interface DeliveryReadyEmailBatchResult {
    emailsSent: number;
    groupsSent: {
        requestIds: string[];
        recipients: string[];
    }[];
    processedGroups: {
        readyEvents: {
            requestId: string;
            readyEventId: number;
        }[];
        recipients: string[];
        completed?: boolean;
        skipped?: boolean;
    }[];
}

function addUnique(values: string[], value: string) {
    if (!values.includes(value)) {
        values.push(value);
    }
}

function getDeliveryReadyBatchKey(details: {
    accountId: string;
    deliveryWindow: string;
    addressLine?: string;
    contactName?: string;
    recipients: string[];
}) {
    return [
        details.accountId,
        details.deliveryWindow,
        details.addressLine ?? '',
        details.contactName ?? '',
        details.recipients.join(','),
    ].join('|');
}

export async function sendBatchedDeliveryReadyEmails(
    requests: PendingDeliveryReadyEmailRequest[],
): Promise<DeliveryReadyEmailBatchResult> {
    const groups = new Map<string, DeliveryReadyEmailBatchGroup>();
    const processedGroups: DeliveryReadyEmailBatchResult['processedGroups'] =
        [];

    for (const request of requests) {
        const details = await buildDeliveryEmailDetails(request.requestId);
        if (!details || details.state !== 'ready') {
            processedGroups.push({
                readyEvents: [
                    {
                        requestId: request.requestId,
                        readyEventId: request.readyEventId,
                    },
                ],
                recipients: [],
                completed: true,
                skipped: true,
            });
            continue;
        }

        const recipients = details.recipients
            .filter(
                (recipient) => !request.processedRecipients.includes(recipient),
            )
            .toSorted();
        if (recipients.length === 0) {
            processedGroups.push({
                readyEvents: [
                    {
                        requestId: request.requestId,
                        readyEventId: request.readyEventId,
                    },
                ],
                recipients: [],
                completed: true,
            });
            continue;
        }

        const key = getDeliveryReadyBatchKey({
            accountId: details.accountId,
            deliveryWindow: details.deliveryWindow,
            addressLine: details.addressLine,
            contactName: details.contactName,
            recipients,
        });
        const group = groups.get(key) ?? {
            key,
            readyEvents: [],
            recipients,
            readyItems: [],
            deliveryWindow: details.deliveryWindow,
            addressLine: details.addressLine,
            contactName: details.contactName,
        };

        group.readyEvents.push({
            requestId: details.requestId,
            readyEventId: request.readyEventId,
        });
        if (details.readyItem) {
            addUnique(group.readyItems, details.readyItem);
        }

        groups.set(key, group);
    }

    let emailsSent = 0;
    const groupsSent: DeliveryReadyEmailBatchResult['groupsSent'] = [];

    for (const group of groups.values()) {
        const sendResults = await Promise.allSettled(
            group.recipients.map((recipient) =>
                sendDeliveryReady(recipient, {
                    email: recipient,
                    deliveryWindow: group.deliveryWindow,
                    addressLine: group.addressLine,
                    contactName: group.contactName,
                    manageUrl: CUSTOMER_APP_URL,
                    readyItems: group.readyItems,
                }),
            ),
        );
        const sentRecipients = group.recipients.filter(
            (_recipient, index) => sendResults[index]?.status === 'fulfilled',
        );
        const failedRecipients = group.recipients.filter(
            (_recipient, index) => sendResults[index]?.status === 'rejected',
        );

        if (sentRecipients.length > 0) {
            emailsSent += sentRecipients.length;
            groupsSent.push({
                requestIds: group.readyEvents.map((event) => event.requestId),
                recipients: sentRecipients,
            });
            processedGroups.push({
                readyEvents: group.readyEvents,
                recipients: sentRecipients,
                completed: sentRecipients.length === group.recipients.length,
            });
        }

        if (failedRecipients.length > 0) {
            console.error('Failed to send batched delivery ready email', {
                requestIds: group.readyEvents.map((event) => event.requestId),
                key: group.key,
                failedRecipients,
            });
        }
    }

    return {
        emailsSent,
        groupsSent,
        processedGroups,
    };
}

export async function notifyDeliveryScheduled(requestId: string) {
    return sendDeliveryEmails(requestId, 'scheduled');
}

export async function notifyDeliveryReady(requestId: string) {
    return sendDeliveryEmails(requestId, 'ready');
}

export async function notifyDeliveryCancelled(requestId: string) {
    return sendDeliveryEmails(requestId, 'cancelled');
}
