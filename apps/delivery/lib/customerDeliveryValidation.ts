import { deliveryRunExactLocationTtlMs } from '@gredice/storage/deliveryTrackingPolicy';
import type {
    CustomerDeliveryEtaSummary,
    CustomerDeliveryTrackingSummary,
} from './deliveryDashboardTypes';

export function isCanonicalIsoTimestamp(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function nullableCanonicalIsoTimestamp(value: unknown): value is string | null {
    return value === null || isCanonicalIsoTimestamp(value);
}

export function isCustomerDeliveryTrackingSummary(
    value: unknown,
): value is CustomerDeliveryTrackingSummary | null {
    if (value === null) return true;
    if (
        typeof value !== 'object' ||
        !('status' in value) ||
        (value.status !== 'live' &&
            value.status !== 'delayed' &&
            value.status !== 'offline' &&
            value.status !== 'unavailable') ||
        !('lastAcceptedAt' in value) ||
        !nullableCanonicalIsoTimestamp(value.lastAcceptedAt) ||
        !('mapAvailable' in value) ||
        typeof value.mapAvailable !== 'boolean' ||
        !('exactLocationExpiresInMs' in value)
    ) {
        return false;
    }
    const expiresInMs = value.exactLocationExpiresInMs;
    const hasAcceptedLocation = value.lastAcceptedAt !== null;
    if (value.status === 'unavailable') {
        return (
            !hasAcceptedLocation && !value.mapAvailable && expiresInMs === null
        );
    }
    if (!hasAcceptedLocation) return false;
    if (value.mapAvailable) {
        return (
            (value.status === 'live' || value.status === 'delayed') &&
            typeof expiresInMs === 'number' &&
            Number.isSafeInteger(expiresInMs) &&
            expiresInMs >= 0 &&
            expiresInMs <= deliveryRunExactLocationTtlMs
        );
    }
    return expiresInMs === null;
}

function nullableNonnegativeFiniteNumber(
    value: unknown,
): value is number | null {
    return (
        value === null ||
        (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    );
}

export function isCustomerDeliveryEtaSummary(
    value: unknown,
): value is CustomerDeliveryEtaSummary {
    if (
        typeof value !== 'object' ||
        value === null ||
        !('source' in value) ||
        !('calculatedAt' in value) ||
        !nullableCanonicalIsoTimestamp(value.calculatedAt) ||
        !('freshness' in value) ||
        !('confidence' in value) ||
        !('rangeStartAt' in value) ||
        !nullableCanonicalIsoTimestamp(value.rangeStartAt) ||
        !('rangeEndAt' in value) ||
        !nullableCanonicalIsoTimestamp(value.rangeEndAt) ||
        !('remainingMinSeconds' in value) ||
        !nullableNonnegativeFiniteNumber(value.remainingMinSeconds) ||
        !('remainingMaxSeconds' in value) ||
        !nullableNonnegativeFiniteNumber(value.remainingMaxSeconds)
    ) {
        return false;
    }

    const hasRange = value.rangeStartAt !== null && value.rangeEndAt !== null;
    const hasRemaining =
        value.remainingMinSeconds !== null &&
        value.remainingMaxSeconds !== null;
    if (hasRange !== hasRemaining) {
        return false;
    }
    if (hasRange) {
        const rangeStartAt = value.rangeStartAt;
        const rangeEndAt = value.rangeEndAt;
        const remainingMinSeconds = value.remainingMinSeconds;
        const remainingMaxSeconds = value.remainingMaxSeconds;
        if (
            rangeStartAt === null ||
            rangeEndAt === null ||
            remainingMinSeconds === null ||
            remainingMaxSeconds === null ||
            Date.parse(rangeStartAt) >= Date.parse(rangeEndAt) ||
            remainingMinSeconds > remainingMaxSeconds
        ) {
            return false;
        }
    }

    if (value.source === 'traffic-route') {
        return (
            value.freshness === 'fresh' &&
            value.confidence === 'high' &&
            value.calculatedAt !== null &&
            hasRange
        );
    }
    if (value.source === 'route-plan') {
        return (
            value.freshness === 'fresh' &&
            value.confidence === 'approximate' &&
            value.calculatedAt !== null &&
            hasRange
        );
    }
    if (value.source !== 'promised-window') return false;
    if (value.freshness === 'fallback') {
        return (
            value.confidence === 'approximate' &&
            value.calculatedAt === null &&
            hasRange
        );
    }
    if (value.freshness === 'stale') {
        return (
            value.confidence === 'approximate' &&
            value.calculatedAt !== null &&
            hasRange
        );
    }
    return (
        value.freshness === 'unavailable' &&
        value.confidence === 'none' &&
        value.calculatedAt === null &&
        !hasRange
    );
}
