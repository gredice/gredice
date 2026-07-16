import type {
    DeliveryRunEstimateSource,
    DeliveryRunExceptionOutcome,
    DeliveryRunExceptionReason,
} from '@gredice/storage';

export type DeliveryTrackingStatus =
    | 'live'
    | 'delayed'
    | 'offline'
    | 'unavailable';

export type DeliveryTrackingFreshnessSummary = {
    status: DeliveryTrackingStatus;
    lastAcceptedAt: string | null;
    mapAvailable: boolean;
};

export type DriverDeliveryTrackingLocation = {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    capturedAt: string;
    acceptedAt: string;
};

export type CustomerDeliveryTrackingSummary = DeliveryTrackingFreshnessSummary;

export type DeliveryHarvestSummary = {
    plantName: string;
    operationName: string | null;
    raisedBedName: string | null;
    fieldName: string | null;
    tracePath: string | null;
};

export type DeliveryExceptionOutcome = DeliveryRunExceptionOutcome;

export type DeliveryExceptionReason = DeliveryRunExceptionReason;

export type DriverDeliveryExceptionSummary = {
    outcome: DeliveryExceptionOutcome;
    reason: DeliveryExceptionReason;
    note: string | null;
    occurredAt: string;
};

export type CustomerDeliveryRecoverySummary =
    | { kind: 'retry-planned' }
    | {
          kind: 'hq-pickup';
          pickupAddress: string;
          pickupDeadlineAt: string;
          pickupWindowHours: 72;
      }
    | { kind: 'hq-pickup-expired' }
    | { kind: 'support' }
    | { kind: 'cancelled' };

export type DeliveryStopDeliverySummary = {
    stopId: number | null;
    stopState: string | null;
    requestId: string;
    requestState: string;
    contactName: string;
    phone: string | null;
    addressLabel: string | null;
    requestNotes: string | null;
    deliveryNotes: string | null;
    harvest: DeliveryHarvestSummary;
    exception: DriverDeliveryExceptionSummary | null;
};

export type DeliveryStopSummary = {
    id: number | null;
    requestId: string;
    sequence: number | null;
    stopState: string | null;
    requestState: string;
    statusLabel: string;
    isCurrent: boolean;
    contactName: string;
    phone: string | null;
    address: string;
    addressLabel: string | null;
    requestNotes: string | null;
    deliveryNotes: string | null;
    slotStartAt: string | null;
    slotEndAt: string | null;
    estimatedArrivalAt: string | null;
    estimatedTravelSeconds: number | null;
    estimatedDistanceMeters: number | null;
    reroutePending: boolean;
    arrivedAt: string | null;
    deliveredAt: string | null;
    harvest: DeliveryHarvestSummary;
    recovery: CustomerDeliveryRecoverySummary | null;
    tracking: CustomerDeliveryTrackingSummary | null;
    runId: string | null;
    deliveryCount: number;
    deliveries: DeliveryStopDeliverySummary[];
    actionState?: 'locked' | 'upcoming' | 'current' | 'completed';
    lockedReason?: string | null;
};

export type DeliveryPickupManifestItemState =
    | 'ready'
    | 'scanned'
    | 'missing-label'
    | 'not-ready';

export type DeliveryPickupManifestItemSummary = {
    id: string;
    stopId: number;
    requestId: string;
    stopKey: string;
    state: DeliveryPickupManifestItemState;
    resolvedAt: string | null;
    tracePath: string | null;
    harvest: DeliveryHarvestSummary;
};

export type DeliveryPickupManifestSummary = {
    id: string;
    timeSlotId: number | null;
    startAt: string;
    endAt: string;
    state: 'pending' | 'confirmed';
    confirmedAt: string | null;
    expectedCount: number;
    scannedCount: number;
    missingLabelCount: number;
    notReadyCount: number;
    remainingCount: number;
    items: DeliveryPickupManifestItemSummary[];
};

export type DeliveryPickupStepSummary = {
    id: string;
    pickupLocationId: number | null;
    sequence: number;
    itinerarySequence: number;
    name: string;
    address: string;
    estimatedArrivalAt: string | null;
    estimatedTravelSeconds: number | null;
    estimatedDistanceMeters: number | null;
    serviceDurationSeconds: number | null;
    state: 'pending' | 'partial' | 'confirmed';
    isCurrent: boolean;
    expectedCount: number;
    scannedCount: number;
    missingLabelCount: number;
    notReadyCount: number;
    remainingCount: number;
    manifests: DeliveryPickupManifestSummary[];
};

export type DeliveryRouteStepSummary =
    | {
          kind: 'pickup';
          itinerarySequence: number;
          actionState: 'locked' | 'current' | 'completed';
          pickup: DeliveryPickupStepSummary;
      }
    | {
          kind: 'delivery';
          itinerarySequence: number;
          mapNodeId?: string;
          retryLaneRank: number | null;
          retryAttempt: number;
          actionState: 'locked' | 'upcoming' | 'current' | 'completed';
          lockedReason: string | null;
          stop: DeliveryStopSummary;
      };

export type DeliveryBatchSummary = {
    slotId: number;
    startAt: string;
    endAt: string;
    pickupLocationId: number;
    pickupLocationName: string | null;
    pickupAddress: string | null;
    deliveryCount: number;
    stopCount: number;
    orders: DeliveryRouteOrderSummary[];
};

export type DeliveryRouteOrderSummary = {
    requestId: string;
    stopKey: string;
    readyForPickup: boolean;
    pickupStatusLabel: string;
    contactName: string;
    address: string;
    addressLabel: string | null;
    requestNotes: string | null;
    harvest: DeliveryHarvestSummary;
};

export type ActiveDeliveryRunSummary = {
    id: string;
    state: string;
    startedAt: string;
    completedAt: string | null;
    totalDistanceMeters: number | null;
    totalDurationSeconds: number | null;
    routePlanVersion: number;
    routeRevision: number;
    reroutePending: boolean;
    estimateSource: DeliveryRunEstimateSource;
    tracking: DeliveryTrackingFreshnessSummary;
    location: DriverDeliveryTrackingLocation | null;
    estimatesUpdatedAt: string | null;
    mapUrl: string;
    deliveryCount: number;
    stops: DeliveryStopSummary[];
    routeSteps: DeliveryRouteStepSummary[];
};

export type DriverDeliveryDashboard = {
    kind: 'driver';
    user: {
        id: string;
        displayName: string;
        role: string;
    };
    activeRun: ActiveDeliveryRunSummary | null;
    batches: DeliveryBatchSummary[];
    maximumRouteStops: number;
    maximumRouteWindowHours: number;
    refreshedAt: string;
};

export type CustomerDeliveryDashboard = {
    kind: 'customer';
    user: {
        id: string;
        displayName: string;
        role: string;
    };
    deliveries: DeliveryStopSummary[];
    refreshedAt: string;
};

export type DeliveryDashboard =
    | DriverDeliveryDashboard
    | CustomerDeliveryDashboard;
