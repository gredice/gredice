import type {
    DeliveryRouteOrderSummary,
    DeliveryStopDeliverySummary,
} from './deliveryDashboardTypes';

const harvestTraceTokenPattern = /^[A-Za-z0-9_-]{16,96}$/;
const harvestTraceBaseUrl = 'https://www.gredice.com';

function isGrediceHostname(hostname: string) {
    return hostname === 'gredice.com' || hostname.endsWith('.gredice.com');
}

export function normalizeHarvestTraceScanValue(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (harvestTraceTokenPattern.test(trimmed)) {
        return `/trag/${trimmed}`;
    }

    let url: URL;
    try {
        url = new URL(trimmed, harvestTraceBaseUrl);
    } catch {
        return null;
    }

    const isAbsoluteUrl =
        /^[A-Za-z][A-Za-z\d+.-]*:/.test(trimmed) || trimmed.startsWith('//');
    if (
        isAbsoluteUrl &&
        (url.protocol !== 'https:' ||
            !isGrediceHostname(url.hostname) ||
            Boolean(url.username) ||
            Boolean(url.password))
    ) {
        return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (
        segments.length !== 2 ||
        segments[0] !== 'trag' ||
        !harvestTraceTokenPattern.test(segments[1] ?? '')
    ) {
        return null;
    }

    return `/trag/${segments[1]}`;
}

type HarvestTraceSelectionContext = {
    tracePath: string;
    plantName: string;
    contactName: string;
    deliveryCount: number;
};

export type HarvestTraceSelectionResult =
    | { status: 'invalid' }
    | { status: 'not-found'; tracePath: string }
    | { status: 'ambiguous'; tracePath: string }
    | {
          status: 'not-ready';
          tracePath: string;
          plantName: string;
          contactName: string;
      }
    | ({ status: 'already-selected' } & HarvestTraceSelectionContext)
    | ({ status: 'limit-reached' } & HarvestTraceSelectionContext)
    | ({
          status: 'selected';
          nextSelectedRequestIds: string[];
          newlySelectedCount: number;
      } & HarvestTraceSelectionContext);

type HarvestTraceVerificationContext = {
    tracePath: string;
    plantName: string;
    contactName: string;
};

export type HarvestTraceVerificationResult =
    | { status: 'verification-invalid' }
    | { status: 'not-at-stop'; tracePath: string }
    | ({ status: 'already-verified' } & HarvestTraceVerificationContext)
    | ({
          status: 'verified';
          nextVerifiedTracePaths: string[];
      } & HarvestTraceVerificationContext);

export function selectDeliveryStopFromHarvestTrace({
    orders,
    selectedRequestIds,
    maximumRouteStops,
    scanValue,
}: {
    orders: DeliveryRouteOrderSummary[];
    selectedRequestIds: string[];
    maximumRouteStops: number;
    scanValue: string;
}): HarvestTraceSelectionResult {
    const tracePath = normalizeHarvestTraceScanValue(scanValue);
    if (!tracePath) return { status: 'invalid' };

    const matchingOrders = orders.filter(
        (order) =>
            order.harvest.tracePath &&
            normalizeHarvestTraceScanValue(order.harvest.tracePath) ===
                tracePath,
    );
    if (matchingOrders.length === 0) {
        return { status: 'not-found', tracePath };
    }

    const readyMatchingOrders = matchingOrders.filter(
        (order) => order.readyForPickup,
    );
    if (readyMatchingOrders.length === 0) {
        const matchingOrder = matchingOrders[0];
        if (!matchingOrder) {
            return { status: 'not-found', tracePath };
        }
        return {
            status: 'not-ready',
            tracePath,
            plantName: matchingOrder.harvest.plantName,
            contactName: matchingOrder.contactName,
        };
    }

    const matchingStopKeys = new Set(
        readyMatchingOrders.map((order) => order.stopKey),
    );
    if (matchingStopKeys.size !== 1) {
        return { status: 'ambiguous', tracePath };
    }

    const matchedOrder = readyMatchingOrders[0];
    if (!matchedOrder) {
        return { status: 'not-found', tracePath };
    }

    const stopOrders = orders.filter(
        (order) =>
            order.stopKey === matchedOrder.stopKey && order.readyForPickup,
    );
    const availableRequestIds = new Set(
        orders.flatMap((order) =>
            order.readyForPickup ? [order.requestId] : [],
        ),
    );
    const availableSelectedRequestIds = Array.from(
        new Set(
            selectedRequestIds.filter((requestId) =>
                availableRequestIds.has(requestId),
            ),
        ),
    );
    const selectedRequestIdSet = new Set(availableSelectedRequestIds);
    const context = {
        tracePath,
        plantName: matchedOrder.harvest.plantName,
        contactName: matchedOrder.contactName,
        deliveryCount: stopOrders.length,
    };

    if (
        stopOrders.every((order) => selectedRequestIdSet.has(order.requestId))
    ) {
        return { status: 'already-selected', ...context };
    }

    const ordersByRequestId = new Map(
        orders.map((order) => [order.requestId, order]),
    );
    const selectedStopKeys = new Set(
        availableSelectedRequestIds.flatMap((requestId) => {
            const order = ordersByRequestId.get(requestId);
            return order ? [order.stopKey] : [];
        }),
    );
    if (
        !selectedStopKeys.has(matchedOrder.stopKey) &&
        selectedStopKeys.size >= maximumRouteStops
    ) {
        return { status: 'limit-reached', ...context };
    }

    const newlySelectedCount = stopOrders.filter(
        (order) => !selectedRequestIdSet.has(order.requestId),
    ).length;
    for (const order of stopOrders) {
        selectedRequestIdSet.add(order.requestId);
    }

    return {
        status: 'selected',
        ...context,
        nextSelectedRequestIds: Array.from(selectedRequestIdSet),
        newlySelectedCount,
    };
}

export function verifyDeliveryStopHarvestTrace({
    deliveries,
    verifiedTracePaths,
    scanValue,
}: {
    deliveries: DeliveryStopDeliverySummary[];
    verifiedTracePaths: string[];
    scanValue: string;
}): HarvestTraceVerificationResult {
    const tracePath = normalizeHarvestTraceScanValue(scanValue);
    if (!tracePath) return { status: 'verification-invalid' };

    const matchingDelivery = deliveries.find(
        (delivery) =>
            delivery.harvest.tracePath &&
            normalizeHarvestTraceScanValue(delivery.harvest.tracePath) ===
                tracePath,
    );
    if (!matchingDelivery) {
        return { status: 'not-at-stop', tracePath };
    }

    const normalizedVerifiedTracePaths = new Set(
        verifiedTracePaths.flatMap((value) => {
            const normalized = normalizeHarvestTraceScanValue(value);
            return normalized ? [normalized] : [];
        }),
    );
    const context = {
        tracePath,
        plantName: matchingDelivery.harvest.plantName,
        contactName: matchingDelivery.contactName,
    };

    if (normalizedVerifiedTracePaths.has(tracePath)) {
        return { status: 'already-verified', ...context };
    }

    normalizedVerifiedTracePaths.add(tracePath);
    return {
        status: 'verified',
        ...context,
        nextVerifiedTracePaths: Array.from(normalizedVerifiedTracePaths),
    };
}
