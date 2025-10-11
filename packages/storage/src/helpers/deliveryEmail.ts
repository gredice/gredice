import 'server-only';
import { formatDeliveryWindow } from '@gredice/js/delivery';
import { getAccountUsers } from '../repositories/accountsRepo';
import { getDeliveryRequest } from '../repositories/deliveryRequestsRepo';
import { getUser } from '../repositories/usersRepo';

export interface DeliveryEmailDetails {
    requestId: string;
    accountId: string;
    deliveryWindow: string;
    recipients: string[];
    addressLine?: string;
    contactName?: string;
}

export interface BuildDeliveryEmailDetailsOptions {
    userId?: string;
}

export async function buildDeliveryEmailDetails(
    requestId: string,
    { userId }: BuildDeliveryEmailDetailsOptions = {},
): Promise<DeliveryEmailDetails | null> {
    const request = await getDeliveryRequest(requestId);

    if (!request || request.mode !== 'delivery' || !request.slot) {
        return null;
    }

    if (!request.accountId) {
        return null;
    }

    const recipients = new Set<string>();

    if (userId) {
        const user = await getUser(userId);
        const email = user?.userName?.trim();
        if (email) {
            recipients.add(email);
        }
    }

    const accountUsers = await getAccountUsers(request.accountId);
    for (const accountUser of accountUsers) {
        const email = accountUser.user?.userName?.trim();
        if (email) {
            recipients.add(email);
        }
    }

    if (recipients.size === 0) {
        return null;
    }

    const deliveryWindow = formatDeliveryWindow(
        request.slot.startAt,
        request.slot.endAt,
    );

    const addressLine = request.address
        ? [request.address.street1, request.address.city]
              .filter(Boolean)
              .join(', ')
        : undefined;

    return {
        requestId: request.id,
        accountId: request.accountId,
        deliveryWindow,
        recipients: Array.from(recipients),
        addressLine,
        contactName: request.address?.contactName ?? undefined,
    };
}
