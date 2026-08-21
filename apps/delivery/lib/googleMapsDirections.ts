const googleMapsDirectionsUrl =
    'https://www.google.com/maps/dir/?api=1&destination=';

export function buildGoogleMapsDirectionsUrl(destination: string) {
    return `${googleMapsDirectionsUrl}${encodeURIComponent(destination)}`;
}
