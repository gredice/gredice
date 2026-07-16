import {
    type CustomerDeliveryTrackerInput,
    customerDeliveryTracker,
} from './customerDeliveryTracker';
import type {
    CustomerDeliveryRequestSummary,
    CustomerPickupRequestSummary,
    DeliveryStopSummary,
} from './deliveryDashboardTypes';

type CustomerDeliveryProjectionSource = Pick<
    DeliveryStopSummary,
    | 'stopState'
    | 'requestId'
    | 'requestState'
    | 'statusLabel'
    | 'requestNotes'
    | 'slotStartAt'
    | 'slotEndAt'
    | 'estimatedArrivalAt'
    | 'reroutePending'
    | 'deliveredAt'
    | 'harvest'
    | 'receipt'
    | 'recovery'
    | 'tracking'
    | 'runId'
>;

export type CustomerDeliveryProjectionContext = Pick<
    CustomerDeliveryTrackerInput,
    | 'now'
    | 'runState'
    | 'stopsAhead'
    | 'estimatesCalculatedAt'
    | 'estimateSource'
    | 'routePlanVersion'
    | 'hasTrafficRouteArtifact'
    | 'trackingStatus'
    | 'trackingLastAcceptedAt'
>;

export function customerDeliveryRequestSummary(
    source: CustomerDeliveryProjectionSource,
    context: CustomerDeliveryProjectionContext,
): CustomerDeliveryRequestSummary {
    const tracking = source.tracking;
    const { eta, progress } = customerDeliveryTracker({
        ...context,
        stopState: source.stopState,
        promisedWindowStartAt: source.slotStartAt,
        promisedWindowEndAt: source.slotEndAt,
        estimatedArrivalAt: source.estimatedArrivalAt,
        reroutePending: source.reroutePending,
    });
    return {
        mode: 'delivery',
        requestId: source.requestId,
        status: source.requestState,
        statusLabel: source.statusLabel,
        requestNotes: source.requestNotes,
        slotStartAt: source.slotStartAt,
        slotEndAt: source.slotEndAt,
        eta,
        progress,
        deliveredAt: source.deliveredAt,
        harvest: source.harvest,
        receipt: source.receipt ?? null,
        recovery: source.recovery,
        tracking,
        mapPath: tracking && source.runId ? `/api/map/${source.runId}` : null,
    };
}

export function customerPickupStatusLabel(status: string) {
    switch (status) {
        case 'pending':
            return 'Čeka potvrdu';
        case 'confirmed':
            return 'Preuzimanje potvrđeno';
        case 'preparing':
            return 'Urod se priprema';
        case 'ready':
            return 'Spremno za preuzimanje';
        case 'fulfilled':
            return 'Preuzeto';
        case 'deferred':
            return 'Preuzimanje je odgođeno';
        case 'failed':
            return 'Preuzimanje trenutačno nije moguće';
        case 'cancelled':
            return 'Preuzimanje je otkazano';
        default:
            return status;
    }
}

export function customerPickupInstructions(status: string) {
    if (status === 'ready') {
        return 'Urod je spreman. Preuzmi ga na ovoj lokaciji tijekom odabranog termina.';
    }
    if (status === 'fulfilled') {
        return 'Preuzimanje uroda je evidentirano.';
    }
    if (status === 'cancelled') {
        return 'Ovo preuzimanje više nije aktivno.';
    }
    if (status === 'deferred' || status === 'failed') {
        return 'Pričekaj novu potvrdu prije dolaska na lokaciju preuzimanja.';
    }
    return 'Pričekaj status „Spremno za preuzimanje” prije dolaska.';
}

export function customerPickupRequestSummary({
    requestId,
    status,
    requestNotes,
    slotStartAt,
    slotEndAt,
    harvest,
    location,
    pickedUpAt,
}: Omit<CustomerPickupRequestSummary, 'mode' | 'statusLabel'>) {
    return {
        mode: 'pickup',
        requestId,
        status,
        statusLabel: customerPickupStatusLabel(status),
        requestNotes,
        slotStartAt,
        slotEndAt,
        harvest,
        location,
        pickedUpAt,
    } satisfies CustomerPickupRequestSummary;
}
