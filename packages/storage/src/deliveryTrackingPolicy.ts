export const deliveryRunTrackingLiveThresholdMs = 30 * 1000;
export const deliveryRunExactLocationTtlMs = 2 * 60 * 1000;

// `:` cannot occur in a Google encoded polyline (encoded values start at ASCII
// 63), so this prefix is an unambiguous, reversible marker inside the existing
// nullable column. Unmarked legacy values predate provider-safe persistence.
const legacyGoogleRouteArtifactPrefix = 'gredice-google-v1:';

export function persistLegacyGoogleRoutePolyline(
    encodedPolyline: string | null | undefined,
) {
    return encodedPolyline
        ? `${legacyGoogleRouteArtifactPrefix}${encodedPolyline}`
        : null;
}

export function hasLegacyGoogleRouteArtifact(
    encodedPolyline: string | null | undefined,
) {
    return Boolean(
        encodedPolyline?.startsWith(legacyGoogleRouteArtifactPrefix) &&
            encodedPolyline.length > legacyGoogleRouteArtifactPrefix.length,
    );
}

export function deliveryRunRoutePolyline(
    encodedPolyline: string | null | undefined,
) {
    if (!encodedPolyline) return null;
    if (!encodedPolyline.startsWith(legacyGoogleRouteArtifactPrefix)) {
        return encodedPolyline;
    }
    const route = encodedPolyline.slice(legacyGoogleRouteArtifactPrefix.length);
    return route || null;
}
