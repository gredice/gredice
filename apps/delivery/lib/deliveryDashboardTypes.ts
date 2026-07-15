export type DeliveryTrackingLocation = {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    recordedAt: string;
};

export type DeliveryHarvestSummary = {
    plantName: string;
    operationName: string | null;
    raisedBedName: string | null;
    fieldName: string | null;
    tracePath: string | null;
};

export type DeliveryContactSummary = {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
};

export type DeliveryStopDeliverySummary = {
    requestId: string;
    requestState: string;
    contactName: string;
    phone: string | null;
    addressLabel: string | null;
    requestNotes: string | null;
    deliveryNotes: string | null;
    harvest: DeliveryHarvestSummary;
    accountContacts: DeliveryContactSummary[];
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
    arrivedAt: string | null;
    deliveredAt: string | null;
    harvest: DeliveryHarvestSummary;
    accountContacts: DeliveryContactSummary[];
    tracking: DeliveryTrackingLocation | null;
    runId: string | null;
    deliveryCount: number;
    deliveries: DeliveryStopDeliverySummary[];
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
    location: DeliveryTrackingLocation | null;
    estimatesUpdatedAt: string | null;
    mapUrl: string;
    deliveryCount: number;
    stops: DeliveryStopSummary[];
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
