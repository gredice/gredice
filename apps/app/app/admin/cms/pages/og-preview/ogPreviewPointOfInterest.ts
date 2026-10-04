export function parseOgImagePointOfInterest(value: string | null) {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
        return null;
    }

    const coordinate = Number(normalizedValue);
    return Number.isInteger(coordinate) && coordinate >= 0 && coordinate <= 100
        ? coordinate
        : null;
}
