import {
    DeliveryRunStates,
    deliveryRunExactLocationTtlMs,
    deliveryRunTrackingLiveThresholdMs,
} from '@gredice/storage';
import type {
    CustomerDeliveryTrackingSummary,
    DeliveryTrackingStatus,
    DriverDeliveryTrackingLocation,
} from './deliveryDashboardTypes';

const maximumLocationClockSkewMs = 5 * 60 * 1000;

export type DeliveryTrackingSnapshot = {
    state: string;
    currentLatitude: number | null;
    currentLongitude: number | null;
    currentLocationAccuracy: number | null;
    currentLocationHeading: number | null;
    currentLocationSpeed: number | null;
    currentLocationRecordedAt: Date | null;
    currentLocationReceivedAt: Date | null;
};

function acceptedLocationAgeMs(snapshot: DeliveryTrackingSnapshot, now: Date) {
    if (
        snapshot.state !== DeliveryRunStates.ACTIVE ||
        !snapshot.currentLocationReceivedAt
    ) {
        return null;
    }
    return Math.max(
        0,
        now.getTime() - snapshot.currentLocationReceivedAt.getTime(),
    );
}

export function deliveryTrackingStatus(
    snapshot: DeliveryTrackingSnapshot,
    now = new Date(),
): DeliveryTrackingStatus {
    const ageMs = acceptedLocationAgeMs(snapshot, now);
    if (ageMs === null) return 'unavailable';
    if (ageMs <= deliveryRunTrackingLiveThresholdMs) return 'live';
    if (ageMs <= deliveryRunExactLocationTtlMs) return 'delayed';
    return 'offline';
}

export function deliveryTrackingRecoveryTransition(
    previousStatus: DeliveryTrackingStatus,
    newStatus: DeliveryTrackingStatus,
) {
    return (
        (previousStatus === 'offline' || previousStatus === 'unavailable') &&
        (newStatus === 'live' || newStatus === 'delayed')
    );
}

export function driverDeliveryTrackingLocation(
    snapshot: DeliveryTrackingSnapshot,
    now = new Date(),
): DriverDeliveryTrackingLocation | null {
    const ageMs = acceptedLocationAgeMs(snapshot, now);
    if (
        ageMs === null ||
        ageMs > deliveryRunExactLocationTtlMs ||
        snapshot.currentLatitude === null ||
        snapshot.currentLongitude === null ||
        !snapshot.currentLocationRecordedAt ||
        !snapshot.currentLocationReceivedAt
    ) {
        return null;
    }
    return {
        latitude: snapshot.currentLatitude,
        longitude: snapshot.currentLongitude,
        accuracy: snapshot.currentLocationAccuracy,
        heading: snapshot.currentLocationHeading,
        speed: snapshot.currentLocationSpeed,
        capturedAt: snapshot.currentLocationRecordedAt.toISOString(),
        acceptedAt: snapshot.currentLocationReceivedAt.toISOString(),
    };
}

export function customerDeliveryTrackingSummary(
    snapshot: DeliveryTrackingSnapshot,
    now = new Date(),
): CustomerDeliveryTrackingSummary {
    const status = deliveryTrackingStatus(snapshot, now);
    return {
        status,
        lastAcceptedAt:
            snapshot.state === DeliveryRunStates.ACTIVE
                ? (snapshot.currentLocationReceivedAt?.toISOString() ?? null)
                : null,
        mapAvailable:
            driverDeliveryTrackingLocation(snapshot, now) !== null &&
            (status === 'live' || status === 'delayed'),
    };
}

export function deliveryLocationCaptureTimeIsAcceptable(
    capturedAt: Date,
    receivedAt = new Date(),
) {
    const capturedTime = capturedAt.getTime();
    if (!Number.isFinite(capturedTime)) return false;
    const ageMs = receivedAt.getTime() - capturedTime;
    return (
        ageMs <= deliveryRunExactLocationTtlMs &&
        ageMs >= -maximumLocationClockSkewMs
    );
}
