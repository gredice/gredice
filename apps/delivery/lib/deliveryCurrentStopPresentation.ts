import type { DeliveryStopSummary } from './deliveryDashboardTypes';

export type DeliveryCurrentStopContact = {
    phone: string;
    label: string;
};

export type DeliveryCurrentStopCriticalNote = {
    id: string;
    label: 'Uputa za adresu' | 'Napomena korisnika';
    context: string | null;
    text: string;
};

export function currentDeliveryRouteStep<
    Step extends {
        actionState: 'locked' | 'upcoming' | 'current' | 'completed';
    },
>(steps: readonly Step[]) {
    return steps.find((step) => step.actionState === 'current') ?? null;
}

export function deliveryCurrentStopCommandDeliveries(
    stop: Pick<DeliveryStopSummary, 'stopState' | 'deliveries'>,
) {
    return stop.deliveries.filter((delivery) =>
        stop.stopState === 'deferred'
            ? delivery.stopState === 'deferred'
            : delivery.stopState === 'pending' ||
              delivery.stopState === 'arrived',
    );
}

export function deliveryCurrentStopContacts(
    stop: Pick<DeliveryStopSummary, 'contactName' | 'phone' | 'deliveries'>,
): DeliveryCurrentStopContact[] {
    const namesByPhone = new Map<string, Set<string>>();
    const contacts = stop.deliveries.length
        ? stop.deliveries
        : [
              {
                  contactName: stop.contactName,
                  phone: stop.phone,
              },
          ];

    for (const contact of contacts) {
        const phone = contact.phone?.trim();
        if (!phone) continue;
        const names = namesByPhone.get(phone) ?? new Set<string>();
        const name = contact.contactName.trim();
        if (name) names.add(name);
        namesByPhone.set(phone, names);
    }

    return Array.from(namesByPhone, ([phone, names]) => ({
        phone,
        label: Array.from(names).join(', ') || phone,
    }));
}

export function deliveryCurrentStopCriticalNotes(
    stop: Pick<
        DeliveryStopSummary,
        'addressLabel' | 'requestNotes' | 'deliveries'
    >,
): DeliveryCurrentStopCriticalNote[] {
    const notes: DeliveryCurrentStopCriticalNote[] = [];
    const seen = new Set<string>();
    const add = (
        label: DeliveryCurrentStopCriticalNote['label'],
        text: string | null,
        identity: string,
        context: string | null,
        dedupeIdentity = context ?? 'shared',
    ) => {
        const normalized = text?.trim();
        if (!normalized) return;
        const duplicateKey = `${label}\u0000${dedupeIdentity}\u0000${normalized}`;
        if (seen.has(duplicateKey)) return;
        seen.add(duplicateKey);
        notes.push({
            id: `${identity}:${notes.length}`,
            label,
            context,
            text: normalized,
        });
    };

    if (stop.deliveries.length === 0) {
        add('Uputa za adresu', stop.addressLabel, 'stop-address', null);
        add('Napomena korisnika', stop.requestNotes, 'stop-request', null);
    }
    for (const delivery of stop.deliveries) {
        const context = [
            delivery.contactName.trim(),
            delivery.harvest.plantName.trim(),
        ]
            .filter(Boolean)
            .join(' · ');
        add(
            'Uputa za adresu',
            delivery.addressLabel,
            `${delivery.requestId}:address`,
            context || null,
            delivery.requestId,
        );
        add(
            'Napomena korisnika',
            delivery.requestNotes,
            `${delivery.requestId}:request`,
            context || null,
            delivery.requestId,
        );
    }

    return notes;
}
