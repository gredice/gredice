import type { UpdateDeliveryAddress } from '@gredice/storage';

type DeliveryAddressDistanceFields = Pick<
    UpdateDeliveryAddress,
    'latitude' | 'longitude' | 'roadDistanceKm'
>;

interface DeliveryAddressDistanceSnapshot
    extends DeliveryAddressDistanceFields {
    distanceCalculatedAt?: Date | null;
}

export function shouldRecalculateDeliveryAddressDistance(
    hasAddressFieldChanges: boolean,
    existingDistanceData: DeliveryAddressDistanceSnapshot | null | undefined,
): boolean {
    if (hasAddressFieldChanges) {
        return true;
    }

    return (
        !existingDistanceData ||
        existingDistanceData.latitude == null ||
        existingDistanceData.longitude == null ||
        existingDistanceData.roadDistanceKm == null ||
        existingDistanceData.distanceCalculatedAt == null
    );
}

export function buildDeliveryAddressDistanceUpdate(
    distanceData: DeliveryAddressDistanceFields | null,
    hasFreshDistanceCalculation: boolean,
    now: Date = new Date(),
): Partial<
    Pick<
        UpdateDeliveryAddress,
        'latitude' | 'longitude' | 'roadDistanceKm' | 'distanceCalculatedAt'
    >
> {
    if (!distanceData) {
        return {};
    }

    if (!hasFreshDistanceCalculation) {
        return distanceData;
    }

    return {
        ...distanceData,
        distanceCalculatedAt: now,
    };
}
