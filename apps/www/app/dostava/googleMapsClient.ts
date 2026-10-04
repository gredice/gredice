/// <reference types="google.maps" />

'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

export type DeliveryMapLibraries = {
    LatLngBounds: typeof google.maps.LatLngBounds;
    Map: typeof google.maps.Map;
    Marker: typeof google.maps.Marker;
    Polygon: typeof google.maps.Polygon;
};

declare global {
    interface Window {
        gm_authFailure?: () => void;
    }
}

export const googleMapsAuthFailureEvent =
    'gredice-www-google-maps-auth-failure';

let configuredApiKey: string | null = null;
let mapsAuthFailed = false;
let deliveryMapLibrariesPromise: Promise<DeliveryMapLibraries> | null = null;

function configureGoogleMaps(apiKey: string) {
    if (mapsAuthFailed) {
        throw new Error('Google Maps JavaScript API authorization failed');
    }
    if (configuredApiKey && configuredApiKey !== apiKey) {
        throw new Error('Google Maps JavaScript API key changed after loading');
    }
    if (configuredApiKey) return;

    window.gm_authFailure = () => {
        mapsAuthFailed = true;
        window.dispatchEvent(new Event(googleMapsAuthFailureEvent));
    };
    configuredApiKey = apiKey;
    setOptions({
        key: apiKey,
        v: 'quarterly',
        language: 'hr',
        region: 'HR',
        authReferrerPolicy: 'origin',
    });
}

export function loadDeliveryMapLibraries(apiKey: string) {
    configureGoogleMaps(apiKey);
    if (deliveryMapLibrariesPromise) return deliveryMapLibrariesPromise;

    deliveryMapLibrariesPromise = Promise.all([
        importLibrary('maps'),
        importLibrary('marker'),
        importLibrary('core'),
    ])
        .then(([maps, marker, core]) => ({
            LatLngBounds: core.LatLngBounds,
            Map: maps.Map,
            Marker: marker.Marker,
            Polygon: maps.Polygon,
        }))
        .catch((error: unknown) => {
            deliveryMapLibrariesPromise = null;
            throw error;
        });
    return deliveryMapLibrariesPromise;
}
