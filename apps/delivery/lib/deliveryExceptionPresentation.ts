import type {
    CustomerDeliveryRecoverySummary,
    DeliveryExceptionOutcome,
    DeliveryExceptionReason,
    DeliveryStopDeliverySummary,
    DriverDeliveryExceptionSummary,
} from './deliveryDashboardTypes';

// Matches the published failed-delivery pickup policy on the public delivery page.
export const failedDeliveryHqPickupWindowHours = 72;

export const deliveryExceptionReasonOptions: ReadonlyArray<{
    value: DeliveryExceptionReason;
    label: string;
    description: string;
}> = [
    {
        value: 'customer-unavailable',
        label: 'Korisnik nije dostupan',
        description: 'Nitko ne može preuzeti dostavu na adresi.',
    },
    {
        value: 'address-inaccessible',
        label: 'Adresi se ne može prići',
        description: 'Ulaz ili prilaz trenutačno nije dostupan.',
    },
    {
        value: 'address-wrong',
        label: 'Adresa je pogrešna',
        description: 'Dostavu nije moguće pronaći na navedenoj adresi.',
    },
    {
        value: 'harvest-damaged',
        label: 'Urod je oštećen',
        description: 'Odabrani urod nije prikladan za predaju.',
    },
    {
        value: 'harvest-missing',
        label: 'Urod nedostaje',
        description: 'Odabrani urod nije pronađen u vozilu.',
    },
    {
        value: 'cancellation',
        label: 'Dostava je otkazana',
        description: 'Otkazivanje je potvrđeno s korisnikom ili dispečerom.',
    },
    {
        value: 'operational-other',
        label: 'Drugi operativni problem',
        description: 'Problem nije obuhvaćen ponuđenim razlozima.',
    },
];

export const deliveryExceptionOutcomeOptions: ReadonlyArray<{
    value: Exclude<DeliveryExceptionOutcome, 'cancelled'>;
    label: string;
    description: string;
    terminal: boolean;
}> = [
    {
        value: 'deferred',
        label: 'Pokušaj ponovno kasnije',
        description:
            'Urodi ostaju u ruti i dobivaju jasan redoslijed povratka.',
        terminal: false,
    },
    {
        value: 'failed',
        label: 'Završi bez dostave',
        description: 'Odabrani urodi neće se ponovno dostavljati na ovoj ruti.',
        terminal: true,
    },
];

export function deliveryExceptionReasonLabel(reason: DeliveryExceptionReason) {
    return (
        deliveryExceptionReasonOptions.find((option) => option.value === reason)
            ?.label ?? reason
    );
}

export function deliveryExceptionOutcomeLabel(
    outcome: DeliveryExceptionOutcome,
) {
    switch (outcome) {
        case 'deferred':
            return 'Ponovni pokušaj';
        case 'failed':
            return 'Neuspjela dostava';
        case 'cancelled':
            return 'Otkazano';
    }
}

export function deliveryExceptionOutcomeIsTerminal(
    outcome: DeliveryExceptionOutcome,
) {
    return outcome === 'failed' || outcome === 'cancelled';
}

export type DeliveryExceptionMutation = {
    expectedRouteRevision: number;
    clientOperationId: string;
    occurredAt: string;
    exceptions: Array<{
        stopId: number;
        outcome: DeliveryExceptionOutcome;
        reason: DeliveryExceptionReason;
        note?: string;
    }>;
};

export type DeliveryExceptionSubmitResult =
    | { status: 'saved' }
    | { status: 'retryable'; message: string }
    | { status: 'review-required'; message: string };

export type DeliveryExceptionMutationBuildResult =
    | { status: 'valid'; mutation: DeliveryExceptionMutation }
    | { status: 'invalid'; message: string };

export function actionableDeliveryExceptionItems(
    deliveries: readonly DeliveryStopDeliverySummary[],
) {
    return deliveries.filter(
        (delivery) =>
            delivery.stopId !== null &&
            (delivery.stopState === 'pending' ||
                delivery.stopState === 'arrived'),
    );
}

function deliveryExceptionBaseIdentity(delivery: DeliveryStopDeliverySummary) {
    return [
        delivery.harvest.plantName,
        delivery.harvest.raisedBedName,
        delivery.harvest.fieldName,
        delivery.contactName,
    ]
        .filter(Boolean)
        .join(' · ');
}

function deliveryTraceToken(tracePath: string | null) {
    const pathWithoutQuery = tracePath?.split(/[?#]/)[0];
    return pathWithoutQuery?.split('/').filter(Boolean).at(-1)?.trim() || null;
}

function shortStableIdentifier(value: string) {
    return value.length <= 12
        ? value
        : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/**
 * Produces driver-only item identities. Location is always included when it is
 * available; colliding labels receive a trace-derived suffix, or a request ID
 * fallback when trace provenance cannot distinguish them.
 */
export function deliveryExceptionItemIdentityLabels(
    deliveries: readonly DeliveryStopDeliverySummary[],
) {
    const groups = new Map<string, DeliveryStopDeliverySummary[]>();
    for (const delivery of deliveries) {
        const base = deliveryExceptionBaseIdentity(delivery);
        groups.set(base, [...(groups.get(base) ?? []), delivery]);
    }

    const identities = new Map<string, string>();
    for (const [base, group] of groups) {
        if (group.length === 1) {
            const onlyDelivery = group[0];
            if (onlyDelivery) identities.set(onlyDelivery.requestId, base);
            continue;
        }

        const traceTokenCounts = new Map<string, number>();
        for (const delivery of group) {
            const token = deliveryTraceToken(delivery.harvest.tracePath);
            if (token) {
                traceTokenCounts.set(
                    token,
                    (traceTokenCounts.get(token) ?? 0) + 1,
                );
            }
        }
        const candidates = group.map((delivery) => {
            const traceToken = deliveryTraceToken(delivery.harvest.tracePath);
            return traceToken && traceTokenCounts.get(traceToken) === 1
                ? {
                      delivery,
                      kind: 'trag',
                      value: traceToken,
                  }
                : {
                      delivery,
                      kind: 'zahtjev',
                      value: delivery.requestId,
                  };
        });
        const shortSuffixCounts = new Map<string, number>();
        for (const candidate of candidates) {
            const suffix = `${candidate.kind} ${shortStableIdentifier(candidate.value)}`;
            shortSuffixCounts.set(
                suffix,
                (shortSuffixCounts.get(suffix) ?? 0) + 1,
            );
        }
        for (const candidate of candidates) {
            const shortSuffix = `${candidate.kind} ${shortStableIdentifier(candidate.value)}`;
            const suffix =
                shortSuffixCounts.get(shortSuffix) === 1
                    ? shortSuffix
                    : `${candidate.kind} ${candidate.value}`;
            identities.set(candidate.delivery.requestId, `${base} · ${suffix}`);
        }
    }
    return identities;
}

export function buildDeliveryExceptionMutation({
    deliveries,
    selectedRequestIds,
    outcome,
    reason,
    note,
    expectedRouteRevision,
    clientOperationId,
    occurredAt,
}: {
    deliveries: readonly DeliveryStopDeliverySummary[];
    selectedRequestIds: readonly string[];
    outcome: Exclude<DeliveryExceptionOutcome, 'cancelled'>;
    reason: DeliveryExceptionReason;
    note: string;
    expectedRouteRevision: number;
    clientOperationId: string;
    occurredAt: string;
}): DeliveryExceptionMutationBuildResult {
    const selectedRequestIdSet = new Set(selectedRequestIds);
    const selectedDeliveries = actionableDeliveryExceptionItems(deliveries)
        .filter((delivery) => selectedRequestIdSet.has(delivery.requestId))
        .sort((first, second) => (first.stopId ?? 0) - (second.stopId ?? 0));
    if (selectedDeliveries.length === 0) {
        return {
            status: 'invalid',
            message: 'Odaberi barem jedan urod na koji se problem odnosi.',
        };
    }

    const normalizedNote = note.trim();
    if (normalizedNote.length > 1_000) {
        return {
            status: 'invalid',
            message: 'Napomena smije imati najviše 1000 znakova.',
        };
    }
    if (reason === 'operational-other' && normalizedNote.length === 0) {
        return {
            status: 'invalid',
            message: 'Ukratko opiši operativni problem.',
        };
    }

    const effectiveOutcome: DeliveryExceptionOutcome =
        reason === 'cancellation' ? 'cancelled' : outcome;
    const parsedOccurredAt = new Date(occurredAt);
    if (
        !Number.isInteger(expectedRouteRevision) ||
        expectedRouteRevision < 0 ||
        clientOperationId.trim().length === 0 ||
        !Number.isFinite(parsedOccurredAt.getTime())
    ) {
        return {
            status: 'invalid',
            message:
                'Promjena dostave nije valjana. Osvježi rutu i pokušaj ponovno.',
        };
    }

    return {
        status: 'valid',
        mutation: {
            expectedRouteRevision,
            clientOperationId: clientOperationId.trim(),
            occurredAt: parsedOccurredAt.toISOString(),
            exceptions: selectedDeliveries.flatMap((delivery) =>
                delivery.stopId === null
                    ? []
                    : [
                          {
                              stopId: delivery.stopId,
                              outcome: effectiveOutcome,
                              reason,
                              ...(normalizedNote
                                  ? { note: normalizedNote }
                                  : {}),
                          },
                      ],
            ),
        },
    };
}

export function deliveryExceptionConfirmation(
    mutation: DeliveryExceptionMutation,
) {
    const count = mutation.exceptions.length;
    const outcome = mutation.exceptions[0]?.outcome;
    if (outcome === 'deferred') {
        return count === 1
            ? 'Ponovni pokušaj je dodan na kraj rute za odabrani urod.'
            : `Ponovni pokušaj je dodan na kraj rute za ${count} odabrana uroda.`;
    }
    if (outcome === 'cancelled') {
        return count === 1
            ? 'Otkazivanje je zabilježeno za odabrani urod. Ruta se može nastaviti.'
            : `Otkazivanje je zabilježeno za ${count} odabrana uroda. Ruta se može nastaviti.`;
    }
    return count === 1
        ? 'Neuspjela dostava je zabilježena za odabrani urod. Ruta se može nastaviti.'
        : `Neuspjela dostava je zabilježena za ${count} odabrana uroda. Ruta se može nastaviti.`;
}

function isDeliveryExceptionReason(
    value: string | null | undefined,
): value is DeliveryExceptionReason {
    switch (value) {
        case 'customer-unavailable':
        case 'address-inaccessible':
        case 'address-wrong':
        case 'harvest-damaged':
        case 'harvest-missing':
        case 'cancellation':
        case 'operational-other':
            return true;
        default:
            return false;
    }
}

function isDeliveryExceptionOutcome(
    value: string | null | undefined,
): value is DeliveryExceptionOutcome {
    return value === 'deferred' || value === 'failed' || value === 'cancelled';
}

export function driverDeliveryExceptionSummary({
    state,
    reason,
    note,
    occurredAt,
}: {
    state: string | null | undefined;
    reason: string | null | undefined;
    note: string | null | undefined;
    occurredAt: Date | null | undefined;
}): DriverDeliveryExceptionSummary | null {
    if (
        !isDeliveryExceptionOutcome(state) ||
        !isDeliveryExceptionReason(reason) ||
        !occurredAt
    ) {
        return null;
    }
    return {
        outcome: state,
        reason,
        note: note?.trim() || null,
        occurredAt: occurredAt.toISOString(),
    };
}

export function customerDeliveryRecoverySummary({
    requestState,
    stopState,
    exceptionReason,
    exceptionRecordedAt,
    hqAddress,
    now = new Date(),
}: {
    requestState: string;
    stopState: string | null | undefined;
    exceptionReason: string | null | undefined;
    exceptionRecordedAt?: Date | null;
    hqAddress: string;
    now?: Date;
}): CustomerDeliveryRecoverySummary | null {
    const effectiveState = stopState ?? requestState;
    if (effectiveState === 'deferred') {
        return { kind: 'retry-planned' };
    }
    if (effectiveState === 'cancelled') {
        return { kind: 'cancelled' };
    }
    if (effectiveState !== 'failed') {
        return null;
    }
    if (
        exceptionReason !== 'customer-unavailable' &&
        exceptionReason !== 'address-inaccessible' &&
        exceptionReason !== 'address-wrong'
    ) {
        return { kind: 'support' };
    }

    if (
        !exceptionRecordedAt ||
        !Number.isFinite(exceptionRecordedAt.getTime()) ||
        !Number.isFinite(now.getTime())
    ) {
        return { kind: 'support' };
    }

    const pickupDeadline = new Date(
        exceptionRecordedAt.getTime() +
            failedDeliveryHqPickupWindowHours * 60 * 60 * 1000,
    );
    if (pickupDeadline.getTime() <= now.getTime()) {
        return { kind: 'hq-pickup-expired' };
    }

    return {
        kind: 'hq-pickup',
        pickupAddress: hqAddress,
        pickupDeadlineAt: pickupDeadline.toISOString(),
        pickupWindowHours: failedDeliveryHqPickupWindowHours,
    };
}

export function deliveryDispatchContactHref({
    runId,
    stopId,
}: {
    runId: string;
    stopId: number | null;
}) {
    const subject = stopId
        ? `Pomoć dispečera · ruta ${runId} · stanica ${stopId}`
        : `Pomoć dispečera · ruta ${runId}`;
    return `mailto:kontakt@gredice.com?subject=${encodeURIComponent(subject)}`;
}
