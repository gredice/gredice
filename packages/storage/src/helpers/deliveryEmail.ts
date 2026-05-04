import 'server-only';
import { formatDeliveryWindow } from '@gredice/js/delivery';
import { getAccountUsers } from '../repositories/accountsRepo';
import { getDeliveryRequest } from '../repositories/deliveryRequestsRepo';

export interface DeliveryEmailDetails {
    requestId: string;
    accountId: string;
    state: string;
    deliveryWindow: string;
    recipients: string[];
    addressLine?: string;
    contactName?: string;
    readyItem?: string;
}

export async function buildDeliveryEmailDetails(
    requestId: string,
): Promise<DeliveryEmailDetails | null> {
    const request = await getDeliveryRequest(requestId);

    if (!request || request.mode !== 'delivery' || !request.slot) {
        return null;
    }

    if (!request.accountId) {
        return null;
    }

    // We send emails for delivery to all account users
    const recipients = new Set<string>();
    const accountUsers = await getAccountUsers(request.accountId);
    for (const accountUser of accountUsers) {
        const email = accountUser.user?.userName?.trim().toLowerCase();
        if (email) {
            recipients.add(email);
        }
    }

    if (recipients.size === 0) {
        console.error('No recipients found for delivery request email', {
            requestId,
            accountId: request.accountId,
        });
        return null;
    }

    const deliveryWindow = formatDeliveryWindow(
        request.slot.startAt,
        request.slot.endAt,
    );

    // TODO: Extract address line formatting utility
    // TODO: Use full address in email templates (currently only street1 and city are used)
    const addressLine = request.address
        ? [request.address.street1, request.address.city]
              .filter(Boolean)
              .join(', ')
        : undefined;
    const plantName = request.plantSort?.information?.name?.trim();
    const operationName =
        request.operationData?.information?.label?.trim() ||
        request.operationData?.information?.name?.trim();
    const fieldPosition =
        request.raisedBedField?.positionIndex != null
            ? `polje ${request.raisedBedField.positionIndex + 1}`
            : undefined;
    const locationParts = [request.raisedBed?.name?.trim(), fieldPosition]
        .filter(Boolean)
        .join(', ');
    const readyItemBase = plantName || operationName || 'Dostavna stavka';
    const readyItem = locationParts
        ? `${readyItemBase} (${locationParts})`
        : readyItemBase;

    return {
        requestId: request.id,
        accountId: request.accountId,
        state: request.state,
        deliveryWindow,
        recipients: Array.from(recipients),
        addressLine,
        contactName: request.address?.contactName ?? undefined,
        readyItem,
    };
}
