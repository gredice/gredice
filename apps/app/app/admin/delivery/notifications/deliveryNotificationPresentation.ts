import type {
    DeliveryLifecycleNotificationChannel,
    DeliveryLifecycleNotificationDiagnostic,
    DeliveryLifecycleNotificationHealth,
    DeliveryLifecycleNotificationHealthSeverity,
    DeliveryLifecycleNotificationMilestone,
    DeliveryLifecycleNotificationOutcome,
    DeliveryLifecycleNotificationProvider,
    DeliveryLifecycleNotificationReasonCode,
} from '@gredice/storage';

export type DeliveryNotificationSearchParams = Record<
    string,
    string | string[] | undefined
>;

export type DeliveryNotificationFilterValues = {
    channel: DeliveryLifecycleNotificationChannel | '';
    outcome: DeliveryLifecycleNotificationOutcome | '';
    requestId: string;
    sourceId: string;
};

export type ParsedDeliveryNotificationFilters = {
    filters: {
        channel?: DeliveryLifecycleNotificationChannel;
        outcome?: DeliveryLifecycleNotificationOutcome;
        requestId?: string;
        sourceId?: string;
    };
    hasInvalidFilter: boolean;
    values: DeliveryNotificationFilterValues;
};

export type DeliveryNotificationTimelineGroup = {
    requestId: string;
    sources: {
        channels: {
            channel: DeliveryLifecycleNotificationChannel | null;
            items: DeliveryLifecycleNotificationDiagnostic[];
        }[];
        sourceId: string | null;
    }[];
};

export type DeliveryNotificationTone =
    | 'error'
    | 'info'
    | 'neutral'
    | 'success'
    | 'warning';

const boundedOpaqueIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:~-]{0,127}$/u;

function singleSearchParam(value: string | string[] | undefined) {
    if (value === undefined) return { invalid: false, value: '' };
    if (typeof value === 'string') return { invalid: false, value };
    return { invalid: true, value: '' };
}

function parseOpaqueIdentifier(value: string | string[] | undefined) {
    const param = singleSearchParam(value);
    if (param.invalid || !param.value) {
        return {
            invalid: param.invalid,
            value: undefined,
        };
    }
    if (!boundedOpaqueIdentifierPattern.test(param.value)) {
        return { invalid: true, value: undefined };
    }
    return { invalid: false, value: param.value };
}

function parseChannel(value: string | string[] | undefined) {
    const param = singleSearchParam(value);
    if (param.invalid || !param.value) {
        return {
            invalid: param.invalid,
            value: undefined,
        };
    }
    switch (param.value) {
        case 'email':
        case 'in_app':
        case 'push':
        case 'sms':
            return { invalid: false, value: param.value };
        default:
            return { invalid: true, value: undefined };
    }
}

function parseOutcome(value: string | string[] | undefined) {
    const param = singleSearchParam(value);
    if (param.invalid || !param.value) {
        return {
            invalid: param.invalid,
            value: undefined,
        };
    }
    switch (param.value) {
        case 'accepted':
        case 'clicked':
        case 'deferred':
        case 'dismissed':
        case 'failed':
        case 'opened':
        case 'queued':
        case 'retrying':
        case 'sent':
        case 'suppressed':
        case 'unsubscribed':
            return { invalid: false, value: param.value };
        default:
            return { invalid: true, value: undefined };
    }
}

export function parseDeliveryNotificationFilters(
    searchParams: DeliveryNotificationSearchParams,
): ParsedDeliveryNotificationFilters {
    const requestId = parseOpaqueIdentifier(searchParams.requestId);
    const sourceId = parseOpaqueIdentifier(searchParams.sourceId);
    const channel = parseChannel(searchParams.channel);
    const outcome = parseOutcome(searchParams.outcome);
    const hasInvalidFilter = [requestId, sourceId, channel, outcome].some(
        (result) => result.invalid,
    );

    return {
        filters: {
            channel: channel.value,
            outcome: outcome.value,
            requestId: requestId.value,
            sourceId: sourceId.value,
        },
        hasInvalidFilter,
        values: {
            channel: channel.value ?? '',
            outcome: outcome.value ?? '',
            requestId: requestId.value ?? '',
            sourceId: sourceId.value ?? '',
        },
    };
}

export function groupDeliveryNotificationTimeline(
    items: DeliveryLifecycleNotificationDiagnostic[],
): DeliveryNotificationTimelineGroup[] {
    const requests = new Map<
        string,
        Map<
            string | null,
            Map<
                DeliveryLifecycleNotificationChannel | null,
                DeliveryLifecycleNotificationDiagnostic[]
            >
        >
    >();

    for (const item of items) {
        let sources = requests.get(item.requestId);
        if (!sources) {
            sources = new Map();
            requests.set(item.requestId, sources);
        }

        let channels = sources.get(item.sourceId);
        if (!channels) {
            channels = new Map();
            sources.set(item.sourceId, channels);
        }

        const channelItems = channels.get(item.channel);
        if (channelItems) {
            channelItems.push(item);
        } else {
            channels.set(item.channel, [item]);
        }
    }

    return [...requests].map(([requestId, sources]) => ({
        requestId,
        sources: [...sources].map(([sourceId, channels]) => ({
            channels: [...channels].map(([channel, channelItems]) => ({
                channel,
                items: channelItems,
            })),
            sourceId,
        })),
    }));
}

export function summarizeDeliveryNotificationHealth(
    health: DeliveryLifecycleNotificationHealth,
) {
    const terminalCount = health.channels.reduce(
        (total, channel) => total + channel.terminalCount,
        0,
    );
    const failureCount = health.channels.reduce(
        (total, channel) => total + channel.failureCount,
        0,
    );
    return {
        failureCount,
        failureRate: terminalCount > 0 ? failureCount / terminalCount : 0,
        terminalCount,
    };
}

export function deliveryNotificationChannelLabel(
    channel: DeliveryLifecycleNotificationChannel,
) {
    return {
        email: 'E-mail',
        in_app: 'U aplikaciji',
        push: 'Push',
        sms: 'SMS',
    }[channel];
}

export function deliveryNotificationMilestoneLabel(
    milestone: DeliveryLifecycleNotificationMilestone,
) {
    return {
        arrived: 'Dostavljač je stigao',
        delayed: 'Kašnjenje',
        delivered: 'Isporučeno',
        exception: 'Iznimka u dostavi',
        'near-arrival': 'Dostavljač je blizu',
        'next-stop': 'Sljedeća stanica',
        recovery: 'Oporavak',
        'route-started': 'Ruta je pokrenuta',
    }[milestone];
}

export function deliveryNotificationOutcomeLabel(
    outcome: DeliveryLifecycleNotificationOutcome,
) {
    return {
        accepted: 'Prihvaćeno',
        clicked: 'Kliknuto',
        deferred: 'Odgođeno',
        dismissed: 'Odbačeno',
        failed: 'Neuspješno',
        opened: 'Otvoreno',
        queued: 'U redu čekanja',
        retrying: 'Ponovni pokušaj',
        sent: 'Poslano',
        suppressed: 'Namjerno potisnuto',
        unsubscribed: 'Kanal je odjavljen',
    }[outcome];
}

export function deliveryNotificationOutcomeTone(
    outcome: DeliveryLifecycleNotificationOutcome,
): DeliveryNotificationTone {
    switch (outcome) {
        case 'accepted':
        case 'clicked':
        case 'opened':
        case 'sent':
            return 'success';
        case 'failed':
        case 'unsubscribed':
            return 'error';
        case 'queued':
        case 'retrying':
            return 'warning';
        case 'deferred':
            return 'info';
        case 'dismissed':
        case 'suppressed':
            return 'neutral';
    }
}

export function deliveryNotificationProviderLabel(
    provider: DeliveryLifecycleNotificationProvider,
) {
    return {
        email: 'E-mail',
        push: 'Push',
        router: 'Usmjerivač',
        unknown: 'Nepoznati pružatelj',
    }[provider];
}

export function deliveryNotificationReasonLabel(
    reason: DeliveryLifecycleNotificationReasonCode,
) {
    return {
        attempts_exhausted: 'Pokušaji su iscrpljeni',
        claim_expired_before_send: 'Rezervacija slanja je istekla',
        claimed: 'Preuzeto za slanje',
        digest_daily: 'Dnevni sažetak',
        digest_hourly: 'Satni sažetak',
        digest_weekly: 'Tjedni sažetak',
        eligible_after_quiet_hours: 'Spremno nakon mirnog razdoblja',
        eligible_immediate: 'Spremno za trenutačno slanje',
        eta_threshold_already_emitted: 'ETA prag je već obrađen',
        idempotency_reused: 'Ponovljeni zahtjev nije ponovno poslan',
        invalid_payload: 'Neispravan sadržaj za kanal',
        invalid_recipient: 'Neispravan primatelj',
        missing_push_subscription: 'Nedostaje push pretplata',
        not_recipient: 'Nije primatelj obavijesti',
        notification_expired: 'Obavijest je istekla',
        notification_missing: 'Obavijest nije pronađena',
        preference_disabled: 'Kanal je isključen u postavkama',
        provider_rejected: 'Pružatelj je odbio slanje',
        queued_background: 'Čeka pozadinsko slanje',
        quiet_hours: 'Odgođeno zbog mirnog razdoblja',
        required_notification: 'Obavezna obavijest',
        sender_failed: 'Slanje nije uspjelo',
        sending: 'Slanje je u tijeku',
        sent: 'Slanje je dovršeno',
        unknown: 'Razlog nije zabilježen',
    }[reason];
}

export function deliveryNotificationSeverityLabel(
    severity: DeliveryLifecycleNotificationHealthSeverity,
) {
    return {
        critical: 'Kritično',
        healthy: 'Uredno',
        warning: 'Upozorenje',
    }[severity];
}

export function deliveryNotificationSeverityTone(
    severity: DeliveryLifecycleNotificationHealthSeverity,
): DeliveryNotificationTone {
    switch (severity) {
        case 'critical':
            return 'error';
        case 'healthy':
            return 'success';
        case 'warning':
            return 'warning';
    }
}
