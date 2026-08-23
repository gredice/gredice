export const deliveryPricePerKilometre = 0.2;
export const maximumDeliveryDistanceKilometres = 100;

type Position = {
    lat: number;
    lng: number;
};

type DeliveryQuoteInput = {
    distanceMeters: number;
    isInZagreb: boolean;
};

function isPointOnSegment(
    position: Position,
    first: readonly [longitude: number, latitude: number],
    second: readonly [longitude: number, latitude: number],
) {
    const crossProduct =
        (position.lat - first[1]) * (second[0] - first[0]) -
        (position.lng - first[0]) * (second[1] - first[1]);
    if (Math.abs(crossProduct) > 1e-10) return false;

    return (
        position.lng >= Math.min(first[0], second[0]) &&
        position.lng <= Math.max(first[0], second[0]) &&
        position.lat >= Math.min(first[1], second[1]) &&
        position.lat <= Math.max(first[1], second[1])
    );
}

export function isPositionInsideBoundary(
    position: Position,
    boundary: readonly (readonly [longitude: number, latitude: number])[],
) {
    let isInside = false;

    for (
        let currentIndex = 0, previousIndex = boundary.length - 1;
        currentIndex < boundary.length;
        previousIndex = currentIndex++
    ) {
        const current = boundary[currentIndex];
        const previous = boundary[previousIndex];
        if (!current || !previous) continue;
        if (isPointOnSegment(position, previous, current)) return true;

        const crossesLatitude =
            current[1] > position.lat !== previous[1] > position.lat;
        const intersectionLongitude =
            ((previous[0] - current[0]) * (position.lat - current[1])) /
                (previous[1] - current[1]) +
            current[0];
        if (crossesLatitude && position.lng < intersectionLongitude) {
            isInside = !isInside;
        }
    }

    return isInside;
}

export function buildDeliveryQuote({
    distanceMeters,
    isInZagreb,
}: DeliveryQuoteInput) {
    const distanceKilometres = distanceMeters / 1_000;
    const isAvailable = distanceKilometres <= maximumDeliveryDistanceKilometres;
    const price =
        isAvailable && !isInZagreb
            ? distanceKilometres * deliveryPricePerKilometre
            : 0;

    return {
        distanceKilometres,
        isAvailable,
        isFree: isAvailable && isInZagreb,
        price,
    };
}
