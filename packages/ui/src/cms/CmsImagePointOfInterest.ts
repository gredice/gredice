export const defaultCmsImagePointOfInterest = 50;

function normalizedCoordinate(value: number | null | undefined) {
    return typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100
        ? value
        : defaultCmsImagePointOfInterest;
}

export function cmsImageObjectPosition(
    pointOfInterestX: number | null | undefined,
    pointOfInterestY: number | null | undefined,
) {
    return `${normalizedCoordinate(pointOfInterestX)}% ${normalizedCoordinate(pointOfInterestY)}%`;
}
