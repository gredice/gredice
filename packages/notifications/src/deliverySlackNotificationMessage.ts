export type DeliverySlackNotificationEventType =
    | 'created'
    | 'updated'
    | 'cancelled';

export type DeliverySlackNotificationItem = {
    id: string;
    operationName?: string;
    farmName?: string;
    locationDescription?: string;
    slotStartAt?: Date | string | null;
    mode?: string | null;
    status?: string | null;
};

export type DeliverySlackNotificationMessageOptions = {
    reason?: string | null;
    note?: string | null;
    status?: string | null;
};

function formatDateTime(value?: Date | string | null) {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function uniqueValues(values: (string | undefined)[]) {
    return Array.from(new Set(values.filter((value) => value !== undefined)));
}

function formatMode(mode?: string | null) {
    if (!mode) return undefined;
    return mode === 'delivery' ? 'Dostava' : 'Preuzimanje';
}

function groupTitle(type: DeliverySlackNotificationEventType) {
    if (type === 'created') {
        return ':package: *Nova grupa zahtjeva za dostavu*';
    }

    if (type === 'cancelled') {
        return ':x: *Grupa zahtjeva za dostavu otkazana*';
    }

    return ':package: *Ažurirana grupa zahtjeva za dostavu*';
}

function requestTitle(type: DeliverySlackNotificationEventType) {
    if (type === 'created') {
        return ':package: *Novi zahtjev za dostavu*';
    }

    if (type === 'cancelled') {
        return ':x: *Zahtjev za dostavu otkazan*';
    }

    return ':package: *Ažuriran zahtjev za dostavu*';
}

function appendSharedOrMultipleValues(
    lines: string[],
    values: string[],
    singularLabel: string,
    pluralLabel: string,
) {
    if (values.length === 1) {
        lines.push(`• ${singularLabel}: ${values[0]}`);
    } else if (values.length > 1) {
        lines.push(`• ${pluralLabel}: ${values.join(', ')}`);
    }
}

function formatStatuses(
    items: DeliverySlackNotificationItem[],
    override?: string | null,
) {
    if (override) {
        return [override];
    }

    const counts = new Map<string, number>();
    for (const item of items) {
        if (item.status) {
            counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
        }
    }

    return [...counts.entries()].map(([status, count]) =>
        count > 1 ? `${status} (${count})` : status,
    );
}

export function buildDeliverySlackNotificationMessage(
    items: DeliverySlackNotificationItem[],
    type: DeliverySlackNotificationEventType,
    options: DeliverySlackNotificationMessageOptions = {},
) {
    if (items.length === 0) {
        return undefined;
    }

    if (items.length === 1) {
        const item = items[0];
        if (!item) return undefined;

        const lines = [requestTitle(type), `• ID zahtjeva: ${item.id}`];
        if (item.operationName) {
            lines.push(`• Radnja: ${item.operationName}`);
        }
        if (item.farmName) {
            lines.push(`• Farma: ${item.farmName}`);
        }
        if (item.locationDescription) {
            lines.push(`• Lokacija: ${item.locationDescription}`);
        }

        const formattedSlot = formatDateTime(item.slotStartAt);
        if (formattedSlot) {
            lines.push(`• Termin: ${formattedSlot}`);
        }

        const mode = formatMode(item.mode);
        if (mode) {
            lines.push(`• Način: ${mode}`);
        }

        const status = options.status ?? item.status;
        if (status) {
            lines.push(`• Status: ${status}`);
        }
        if (options.reason) {
            lines.push(`• Razlog: ${options.reason}`);
        }
        if (options.note) {
            lines.push(`• Napomena: ${options.note}`);
        }

        return lines.join('\n');
    }

    const lines = [groupTitle(type), `• Broj zahtjeva: ${items.length}`];
    appendSharedOrMultipleValues(
        lines,
        uniqueValues(items.map((item) => item.farmName)),
        'Farma',
        'Farme',
    );
    appendSharedOrMultipleValues(
        lines,
        uniqueValues(items.map((item) => formatDateTime(item.slotStartAt))),
        'Termin',
        'Termini',
    );
    appendSharedOrMultipleValues(
        lines,
        uniqueValues(items.map((item) => formatMode(item.mode))),
        'Način',
        'Načini',
    );
    appendSharedOrMultipleValues(
        lines,
        formatStatuses(items, options.status),
        'Status',
        'Statusi',
    );

    lines.push('• Zahtjevi:');
    for (const item of items) {
        const context = [item.operationName, item.locationDescription].filter(
            (value) => value !== undefined,
        );
        lines.push(
            `  ◦ ${item.id}${context.length > 0 ? ` — ${context.join(' · ')}` : ''}`,
        );
    }

    if (options.reason) {
        lines.push(`• Razlog: ${options.reason}`);
    }
    if (options.note) {
        lines.push(`• Napomena: ${options.note}`);
    }

    return lines.join('\n');
}
