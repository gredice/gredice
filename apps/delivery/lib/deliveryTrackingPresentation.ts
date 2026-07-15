import type { DeliveryTrackingFreshnessSummary } from './deliveryDashboardTypes';

export function deliveryTrackingMapVersion(
    tracking: DeliveryTrackingFreshnessSummary,
    fallback: string | null = null,
) {
    return `${tracking.status}:${tracking.lastAcceptedAt ?? fallback ?? 'initial'}`;
}
