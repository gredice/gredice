import {
    type BuildDeliveryEmailDetailsOptions,
    buildDeliveryEmailDetails,
} from '@gredice/storage';
import {
    sendDeliveryReady,
    sendDeliveryScheduled,
} from '../email/transactional';

const CUSTOMER_APP_URL =
    process.env.GREDICE_GARDEN_APP_URL ?? 'https://vrt.gredice.com';

type DeliveryNotificationType = 'scheduled' | 'ready';

type DeliverySenders = {
    scheduled: typeof sendDeliveryScheduled;
    ready: typeof sendDeliveryReady;
};

const senders: DeliverySenders = {
    scheduled: sendDeliveryScheduled,
    ready: sendDeliveryReady,
};

async function sendDeliveryEmails(
    requestId: string,
    type: DeliveryNotificationType,
    options?: BuildDeliveryEmailDetailsOptions,
) {
    try {
        const details = await buildDeliveryEmailDetails(requestId, options);
        if (!details) {
            return false;
        }

        await Promise.all(
            details.recipients.map((recipient) =>
                senders[type](recipient, {
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

export async function notifyDeliveryScheduled(
    requestId: string,
    options?: BuildDeliveryEmailDetailsOptions,
) {
    return sendDeliveryEmails(requestId, 'scheduled', options);
}

export async function notifyDeliveryReady(requestId: string) {
    return sendDeliveryEmails(requestId, 'ready');
}
