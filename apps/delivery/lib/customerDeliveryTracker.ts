import {
    DeliveryRunEstimateSources,
    DeliveryRunStates,
    DeliveryRunStopStates,
    deliveryRunExactLocationTtlMs,
} from '@gredice/storage';
import type {
    CustomerDeliveryEtaSummary,
    CustomerDeliveryProgressSummary,
    DeliveryTrackingStatus,
} from './deliveryDashboardTypes';

export type CustomerDeliveryTrackerPresentation = {
    eta: CustomerDeliveryEtaSummary;
    progress: CustomerDeliveryProgressSummary;
};

export type CustomerDeliveryTrackerInput = {
    now: string;
    runState: string | null;
    stopState: string | null;
    stopsAhead: number | null;
    promisedWindowStartAt: string | null;
    promisedWindowEndAt: string | null;
    estimatedArrivalAt: string | null;
    estimatesCalculatedAt: string | null;
    estimateSource: string | null;
    routePlanVersion: number | null;
    hasTrafficRouteArtifact: boolean;
    reroutePending: boolean;
    trackingStatus: DeliveryTrackingStatus | null;
    trackingLastAcceptedAt: string | null;
};

type ParsedTimestamp = {
    iso: string;
    time: number;
};

type ParsedWindow = {
    start: ParsedTimestamp;
    end: ParsedTimestamp;
};

// A route service returns a point estimate, but customers need an honest range.
// Keep the policy deterministic and asymmetric because traffic is more likely to
// add time than remove it. The lower bound never promises time that has passed.
const routeEtaEarlyBandMs = 5 * 60 * 1_000;
const routeEtaLateBandMs = 10 * 60 * 1_000;
const minimumCurrentEtaBandMs = 5 * 60 * 1_000;

function parsedTimestamp(value: string | null): ParsedTimestamp | null {
    if (!value) return null;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return null;
    const iso = new Date(time).toISOString();
    if (iso !== value) return null;
    return { iso, time };
}

function parsedWindow(
    startAt: string | null,
    endAt: string | null,
): ParsedWindow | null {
    const start = parsedTimestamp(startAt);
    const end = parsedTimestamp(endAt);
    if (!start || !end || start.time >= end.time) return null;
    return { start, end };
}

function remainingSeconds(targetTime: number, nowTime: number) {
    return Math.max(0, Math.ceil((targetTime - nowTime) / 1_000));
}

function unavailableEta(): CustomerDeliveryEtaSummary {
    return {
        source: 'promised-window',
        calculatedAt: null,
        freshness: 'unavailable',
        confidence: 'none',
        rangeStartAt: null,
        rangeEndAt: null,
        remainingMinSeconds: null,
        remainingMaxSeconds: null,
    };
}

function promisedWindowEta({
    window,
    nowTime,
    freshness,
    calculatedAt = null,
}: {
    window: ParsedWindow | null;
    nowTime: number;
    freshness: Extract<
        CustomerDeliveryEtaSummary['freshness'],
        'stale' | 'fallback'
    >;
    calculatedAt?: string | null;
}): CustomerDeliveryEtaSummary {
    if (!window) return unavailableEta();
    if (nowTime > window.end.time) return unavailableEta();
    return {
        source: 'promised-window',
        calculatedAt,
        freshness,
        confidence: 'approximate',
        rangeStartAt: window.start.iso,
        rangeEndAt: window.end.iso,
        remainingMinSeconds: remainingSeconds(window.start.time, nowTime),
        remainingMaxSeconds: remainingSeconds(window.end.time, nowTime),
    };
}

function etaPresentation({
    input,
    now,
    window,
}: {
    input: CustomerDeliveryTrackerInput;
    now: ParsedTimestamp;
    window: ParsedWindow | null;
}): CustomerDeliveryEtaSummary {
    const arrival = parsedTimestamp(input.estimatedArrivalAt);
    const calculated = parsedTimestamp(input.estimatesCalculatedAt);
    const trackingAccepted = parsedTimestamp(input.trackingLastAcceptedAt);
    const plannedGoogleRouteProvenance =
        input.estimateSource === DeliveryRunEstimateSources.GOOGLE &&
        Number.isInteger(input.routePlanVersion) &&
        (input.routePlanVersion ?? 0) >= 2;
    // A post-cutover Google GPS refresh persists a marked route artifact while
    // the local estimator explicitly clears it. The marker keeps old and
    // initial legacy polylines conservative without changing the DB schema.
    const persistedTrafficRouteProvenance =
        input.estimateSource === DeliveryRunEstimateSources.LEGACY &&
        input.routePlanVersion === 1 &&
        input.hasTrafficRouteArtifact &&
        trackingAccepted !== null;
    const currentTrafficProvenance =
        persistedTrafficRouteProvenance &&
        (input.trackingStatus === 'live' || input.trackingStatus === 'delayed');
    const calculatedAgeMs = calculated
        ? now.time - calculated.time
        : Number.NaN;
    const estimateIsFresh =
        Number.isFinite(calculatedAgeMs) &&
        calculatedAgeMs >= 0 &&
        calculatedAgeMs < deliveryRunExactLocationTtlMs;
    const routeEstimateIsUsable =
        input.runState === DeliveryRunStates.ACTIVE &&
        !input.reroutePending &&
        (plannedGoogleRouteProvenance || currentTrafficProvenance) &&
        estimateIsFresh &&
        arrival !== null &&
        calculated !== null;

    if (routeEstimateIsUsable) {
        const source = currentTrafficProvenance
            ? 'traffic-route'
            : 'route-plan';
        const confidence = source === 'traffic-route' ? 'high' : 'approximate';
        const rangeStartTime = Math.max(
            now.time,
            arrival.time - routeEtaEarlyBandMs,
        );
        const rangeEndTime = Math.max(
            rangeStartTime + minimumCurrentEtaBandMs,
            arrival.time + routeEtaLateBandMs,
        );
        return {
            source,
            calculatedAt: calculated.iso,
            freshness: 'fresh',
            confidence,
            rangeStartAt: new Date(rangeStartTime).toISOString(),
            rangeEndAt: new Date(rangeEndTime).toISOString(),
            remainingMinSeconds: remainingSeconds(rangeStartTime, now.time),
            remainingMaxSeconds: remainingSeconds(rangeEndTime, now.time),
        };
    }

    const staleGoogleEstimate =
        input.runState === DeliveryRunStates.ACTIVE &&
        !input.reroutePending &&
        (plannedGoogleRouteProvenance || persistedTrafficRouteProvenance) &&
        arrival !== null &&
        calculated !== null &&
        Number.isFinite(calculatedAgeMs) &&
        calculatedAgeMs >= deliveryRunExactLocationTtlMs;

    return promisedWindowEta({
        window,
        nowTime: now.time,
        freshness: staleGoogleEstimate ? 'stale' : 'fallback',
        calculatedAt: staleGoogleEstimate ? calculated?.iso : null,
    });
}

function activeProgress({
    stopState,
    stopsAhead,
}: Pick<CustomerDeliveryTrackerInput, 'stopState' | 'stopsAhead'>): Pick<
    CustomerDeliveryProgressSummary,
    'phase' | 'stopsAhead'
> {
    if (stopState === DeliveryRunStopStates.ARRIVED) {
        return { phase: 'arrived', stopsAhead: 0 };
    }
    if (
        (stopState !== DeliveryRunStopStates.PENDING &&
            stopState !== DeliveryRunStopStates.DEFERRED) ||
        !Number.isSafeInteger(stopsAhead) ||
        (stopsAhead ?? -1) < 0
    ) {
        return { phase: 'unavailable', stopsAhead: null };
    }
    return {
        phase: stopsAhead === 0 ? 'next' : 'on-route',
        stopsAhead,
    };
}

function progressPresentation({
    input,
    eta,
    now,
    window,
}: {
    input: CustomerDeliveryTrackerInput;
    eta: CustomerDeliveryEtaSummary;
    now: ParsedTimestamp;
    window: ParsedWindow | null;
}): CustomerDeliveryProgressSummary {
    const estimatedArrival = parsedTimestamp(input.estimatedArrivalAt);
    const freshRouteIsLate = Boolean(
        eta.source !== 'promised-window' &&
            estimatedArrival &&
            window &&
            estimatedArrival.time > window.end.time,
    );
    const promisedWindowHasPassed = Boolean(
        window && now.time > window.end.time,
    );
    const delayed = freshRouteIsLate || promisedWindowHasPassed;

    if (input.runState === null) {
        return { phase: 'scheduled', stopsAhead: null, delayed };
    }
    if (input.runState !== DeliveryRunStates.ACTIVE) {
        return { phase: 'unavailable', stopsAhead: null, delayed: false };
    }
    return {
        ...activeProgress(input),
        delayed,
    };
}

export function customerDeliveryTracker(
    input: CustomerDeliveryTrackerInput,
): CustomerDeliveryTrackerPresentation {
    const now = parsedTimestamp(input.now);
    if (!now) {
        return {
            eta: unavailableEta(),
            progress: {
                phase: 'unavailable',
                stopsAhead: null,
                delayed: false,
            },
        };
    }
    const window = parsedWindow(
        input.promisedWindowStartAt,
        input.promisedWindowEndAt,
    );
    const eta = etaPresentation({ input, now, window });
    return {
        eta,
        progress: progressPresentation({ input, eta, now, window }),
    };
}
