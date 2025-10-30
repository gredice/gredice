import 'server-only';
import {
    createCalendarEvent,
    deleteCalendarEvent,
    getCalendarEventIdFromRequestId,
    isGoogleCalendarConfigured,
} from '@gredice/google';
import { getDeliveryRequest } from '@gredice/storage';

function formatAddress(parts: Array<string | undefined>): string | undefined {
    const value = parts.filter((part) => Boolean(part?.trim())).join(', ');

    return value.length > 0 ? value : undefined;
}

function buildDeliveryDescription(
    request: Awaited<ReturnType<typeof getDeliveryRequest>>,
): string {
    const details: string[] = [
        `Delivery request ID: ${request?.id ?? 'unknown'}`,
        `Operation ID: ${request?.operationId ?? 'unknown'}`,
    ];

    if (request?.mode) {
        details.push(`Mode: ${request.mode}`);
    }

    if (request?.accountId) {
        details.push(`Account ID: ${request.accountId}`);
    }

    if (request?.slot?.location?.name) {
        details.push(`Location: ${request.slot.location.name}`);
    }

    if (request?.address) {
        details.push(`Contact: ${request.address.contactName}`);
        details.push(`Phone: ${request.address.phone}`);

        const addressLine = formatAddress([
            request.address.street1,
            request.address.street2,
            `${request.address.postalCode} ${request.address.city}`,
            request.address.countryCode,
        ]);

        if (addressLine) {
            details.push(`Address: ${addressLine}`);
        }
    } else if (request?.location) {
        const pickupAddress = formatAddress([
            request.location.street1,
            request.location.street2,
            `${request.location.postalCode} ${request.location.city}`,
            request.location.countryCode,
        ]);

        details.push(`Pickup location: ${request.location.name}`);

        if (pickupAddress) {
            details.push(`Pickup address: ${pickupAddress}`);
        }
    }

    if (request?.requestNotes) {
        details.push(`Notes: ${request.requestNotes}`);
    }

    return details.join('\n');
}

function resolveEventLocation(
    request: Awaited<ReturnType<typeof getDeliveryRequest>>,
): string | undefined {
    if (request?.mode === 'delivery' && request.address) {
        return formatAddress([
            request.address.street1,
            request.address.street2,
            `${request.address.postalCode} ${request.address.city}`,
            request.address.countryCode,
        ]);
    }

    if (request?.location) {
        return formatAddress([
            request.location.name,
            request.location.street1,
            request.location.street2,
            `${request.location.postalCode} ${request.location.city}`,
            request.location.countryCode,
        ]);
    }

    return undefined;
}

export async function createDeliveryRequestCalendarEvent(
    requestId: string,
): Promise<void> {
    if (!isGoogleCalendarConfigured()) {
        return;
    }

    try {
        const request = await getDeliveryRequest(requestId);

        if (!request?.slot) {
            console.warn(
                `Delivery request ${requestId} does not have an associated slot for calendar sync`,
            );
            return;
        }

        await createCalendarEvent({
            id: getCalendarEventIdFromRequestId(requestId),
            summary:
                request.mode === 'pickup'
                    ? 'Pickup window scheduled'
                    : 'Delivery window scheduled',
            description: buildDeliveryDescription(request),
            location: resolveEventLocation(request),
            start: { date: request.slot.startAt },
            end: { date: request.slot.endAt },
        });
    } catch (error) {
        console.error(
            `Failed to create Google Calendar event for delivery request ${requestId}:`,
            error,
        );
    }
}

export async function deleteDeliveryRequestCalendarEvent(
    requestId: string,
): Promise<void> {
    if (!isGoogleCalendarConfigured()) {
        return;
    }

    try {
        await deleteCalendarEvent(getCalendarEventIdFromRequestId(requestId));
    } catch (error) {
        console.error(
            `Failed to delete Google Calendar event for delivery request ${requestId}:`,
            error,
        );
    }
}
