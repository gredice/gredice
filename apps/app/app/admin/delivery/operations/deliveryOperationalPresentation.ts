import type {
    DeliveryOperationalDiagnostic,
    DeliveryOperationalHealth,
} from '@gredice/storage';

export function deliveryOperationalSeverityLabel(
    severity: DeliveryOperationalHealth['severity'],
) {
    switch (severity) {
        case 'critical':
            return 'Kritično';
        case 'warning':
            return 'Upozorenje';
        default:
            return 'Uredno';
    }
}

export function deliveryOperationalSeverityTone(
    severity: DeliveryOperationalHealth['severity'],
) {
    switch (severity) {
        case 'critical':
            return 'error' as const;
        case 'warning':
            return 'warning' as const;
        default:
            return 'success' as const;
    }
}

export function deliveryOperationalDiagnosticTone(
    severity: DeliveryOperationalDiagnostic['severity'],
) {
    switch (severity) {
        case 'critical':
            return 'error' as const;
        case 'warning':
            return 'warning' as const;
        default:
            return 'neutral' as const;
    }
}

export function deliveryOperationalDiagnosticLabel(
    kind: DeliveryOperationalDiagnostic['kind'],
) {
    switch (kind) {
        case 'abandoned-run':
            return 'Napuštena ruta';
        case 'delayed-offline-replay':
            return 'Odgođena sinkronizacija';
        case 'exception-outcome':
            return 'Iznimka dostave';
        case 'local-route-fallback':
            return 'Lokalna procjena rute';
        case 'reroute-stale':
            return 'Zastarjelo preusmjeravanje';
        case 'run-stalled':
            return 'Ruta bez aktivnosti';
        case 'tracking-delayed':
            return 'Odgođeno praćenje';
        case 'tracking-unavailable':
            return 'Praćenje nije dostupno';
    }
}

export function formatDeliveryOperationalPercentage(value: number) {
    return new Intl.NumberFormat('hr-HR', {
        maximumFractionDigits: 1,
        style: 'percent',
    }).format(value);
}

export function formatDeliveryOperationalDuration(value: number) {
    if (value < 60_000) return `${Math.round(value / 1_000)} s`;
    if (value < 60 * 60_000) return `${Math.round(value / 60_000)} min`;
    return `${(value / (60 * 60_000)).toFixed(1)} h`;
}

export function deliveryOperationalExceptionOutcomeLabel(
    outcome: DeliveryOperationalHealth['exceptions'][number]['outcome'],
) {
    switch (outcome) {
        case 'cancelled':
            return 'Otkazano';
        case 'deferred':
            return 'Odgođeno';
        case 'failed':
            return 'Neuspješno';
    }
}

export function deliveryOperationalExceptionReasonLabel(
    reason: DeliveryOperationalHealth['exceptions'][number]['reason'],
) {
    switch (reason) {
        case 'address-inaccessible':
            return 'Adresa nije dostupna';
        case 'address-wrong':
            return 'Adresa nije ispravna';
        case 'cancellation':
            return 'Otkazivanje';
        case 'customer-unavailable':
            return 'Primatelj nije dostupan';
        case 'harvest-damaged':
            return 'Berba je oštećena';
        case 'harvest-missing':
            return 'Berba nedostaje';
        case 'operational-other':
            return 'Drugi operativni razlog';
    }
}
