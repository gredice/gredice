import { buildDeliveryEmailDetails } from '@gredice/storage';
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
    requestIds: string[];
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
    skippedRequestIds: string[];
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
    requestIds: string[],
): Promise<DeliveryReadyEmailBatchResult> {
    const groups = new Map<string, DeliveryReadyEmailBatchGroup>();
    const skippedRequestIds: string[] = [];

    for (const requestId of requestIds) {
        const details = await buildDeliveryEmailDetails(requestId);
        if (!details || details.state !== 'ready') {
            skippedRequestIds.push(requestId);
            continue;
        }

        const recipients = details.recipients.toSorted();
        const key = getDeliveryReadyBatchKey({
            accountId: details.accountId,
            deliveryWindow: details.deliveryWindow,
            addressLine: details.addressLine,
            contactName: details.contactName,
            recipients,
        });
        const group = groups.get(key) ?? {
            key,
            requestIds: [],
            recipients,
            readyItems: [],
            deliveryWindow: details.deliveryWindow,
            addressLine: details.addressLine,
            contactName: details.contactName,
        };

        addUnique(group.requestIds, details.requestId);
        if (details.readyItem) {
            addUnique(group.readyItems, details.readyItem);
        }

        groups.set(key, group);
    }

    let emailsSent = 0;
    const groupsSent: DeliveryReadyEmailBatchResult['groupsSent'] = [];

    for (const group of groups.values()) {
        try {
            await Promise.all(
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
            emailsSent += group.recipients.length;
            groupsSent.push({
                requestIds: group.requestIds,
                recipients: group.recipients,
            });
        } catch (error) {
            console.error('Failed to send batched delivery ready email', {
                requestIds: group.requestIds,
                key: group.key,
                error,
            });
        }
    }

    return {
        emailsSent,
        groupsSent,
        skippedRequestIds,
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
