import { createHmac } from 'node:crypto';
import 'server-only';
import type { DeliveryCoordinates } from './deliveryRouting';

type StaticMapStop = DeliveryCoordinates & { sequence?: number };

function markerValue(
    color: string,
    label: string,
    coordinates: DeliveryCoordinates,
) {
    return [
        `color:${color}`,
        `label:${label}`,
        `${coordinates.latitude},${coordinates.longitude}`,
    ].join('|');
}

function urlSafeBase64(buffer: Buffer) {
    return buffer
        .toString('base64')
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
}

function decodeSigningSecret(secret: string) {
    const standard = secret.replaceAll('-', '+').replaceAll('_', '/');
    const padding = '='.repeat((4 - (standard.length % 4)) % 4);
    return Buffer.from(`${standard}${padding}`, 'base64');
}

export function buildGoogleStaticMapUrl({
    driverLocation,
    stops,
    encodedPolyline,
    customerView,
}: {
    driverLocation?: DeliveryCoordinates | null;
    stops: StaticMapStop[];
    encodedPolyline?: string | null;
    customerView: boolean;
}) {
    const apiKey = process.env.GREDICE_GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey || (stops.length === 0 && !driverLocation)) {
        return null;
    }

    const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
    url.searchParams.set('size', '640x420');
    url.searchParams.set('scale', '2');
    url.searchParams.set('maptype', 'roadmap');
    url.searchParams.set('language', 'hr');
    url.searchParams.set('region', 'HR');
    url.searchParams.set('key', apiKey);
    if (driverLocation) {
        url.searchParams.append(
            'markers',
            markerValue('0x1d4ed8', 'V', driverLocation),
        );
    }
    for (const stop of stops) {
        const label = customerView
            ? 'C'
            : String(stop.sequence ?? '').slice(-1) || 'D';
        url.searchParams.append(
            'markers',
            markerValue(customerView ? '0xdc2626' : '0x166534', label, stop),
        );
    }
    if (!customerView && encodedPolyline && encodedPolyline.length < 8_000) {
        url.searchParams.append(
            'path',
            `color:0x166534dd|weight:5|enc:${encodedPolyline}`,
        );
    }

    const signingSecret =
        process.env.GREDICE_GOOGLE_MAPS_URL_SIGNING_SECRET?.trim();
    if (signingSecret) {
        const signature = createHmac('sha1', decodeSigningSecret(signingSecret))
            .update(`${url.pathname}${url.search}`)
            .digest();
        url.searchParams.set('signature', urlSafeBase64(signature));
    }

    return url;
}

export function unavailableMapSvg(message = 'Karta trenutačno nije dostupna') {
    const safeMessage = message.replace(/[<>&"']/g, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="840" viewBox="0 0 1280 840"><rect width="1280" height="840" fill="#eef3ed"/><path d="M0 180h1280M0 420h1280M0 660h1280M240 0v840M620 0v840M1000 0v840" stroke="#d5dfd2" stroke-width="24"/><circle cx="640" cy="360" r="44" fill="#166534"/><path d="M640 405l-30-54h60z" fill="#166534"/><text x="640" y="500" text-anchor="middle" font-family="system-ui,sans-serif" font-size="34" fill="#334155">${safeMessage}</text></svg>`;
}
