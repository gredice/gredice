import { buildDeliveryEmailDetails } from '@gredice/storage';
import {
    sendDeliveryCancelled,
    sendDeliveryReady,
    sendDeliveryScheduled,
} from '../email/transactional';

// TODO: Move to shared location so env vars can be shared between services
const CUSTOMER_APP_URL =
    process.env.GREDICE_GARDEN_APP_URL ?? 'https://vrt.gredice.com';

const senders = {
    scheduled: sendDeliveryScheduled,
    ready: sendDeliveryReady,
    cancelled: sendDeliveryCancelled,
};

async function sendDeliveryEmails(
    requestId: string,
    type: keyof typeof senders,
) {
    try {
        const details = await buildDeliveryEmailDetails(requestId);
        if (!details) {
            return false;
        }

        await Promise.all(
            details.recipients.map((recipient) =>
                senders[type](recipient, {
                    email: recipient,
                    deliveryWindow: details.deliveryWindow,
                    addressLine: details.addressLine,
                    contactName: details.contactName,
                    manageUrl: CUSTOMER_APP_URL,
                }),
            ),
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

export async function notifyDeliveryScheduled(requestId: string) {
    return sendDeliveryEmails(requestId, 'scheduled');
}

export async function notifyDeliveryReady(requestId: string) {
    return sendDeliveryEmails(requestId, 'ready');
}

export async function notifyDeliveryCancelled(requestId: string) {
    return sendDeliveryEmails(requestId, 'cancelled');
}
