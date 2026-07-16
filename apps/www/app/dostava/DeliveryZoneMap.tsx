/// <reference types="google.maps" />

'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Button } from '@gredice/ui/Button';
import { MyLocation } from '@gredice/ui/icons';
import { useEffect, useRef, useState } from 'react';
import { deliveryRoadAreaPaths } from './deliveryRoadAreaData';
import { grediceHqPosition, zagrebBoundary } from './deliveryZoneMapData';

type MapState = 'loading' | 'ready' | 'fallback';

type GoogleMapsClient = {
    LatLngBounds: typeof google.maps.LatLngBounds;
    Map: typeof google.maps.Map;
    Marker: typeof google.maps.Marker;
    Polygon: typeof google.maps.Polygon;
};

type MapLayers = {
    deliveryArea: google.maps.Polygon[];
    deliveryBounds: google.maps.LatLngBounds | null;
    hqMarker: google.maps.Marker | null;
    zagrebArea: google.maps.Polygon | null;
};

declare global {
    interface Window {
        gm_authFailure?: () => void;
    }
}

const googleMapsAuthFailureEvent = 'gredice-www-google-maps-auth-failure';
let configuredApiKey: string | null = null;
let mapsAuthFailed = false;
let mapsPromise: Promise<GoogleMapsClient> | null = null;

function loadGoogleMaps(apiKey: string) {
    if (mapsAuthFailed) {
        return Promise.reject(
            new Error('Google Maps JavaScript API authorization failed'),
        );
    }
    if (configuredApiKey && configuredApiKey !== apiKey) {
        return Promise.reject(
            new Error('Google Maps JavaScript API key changed after loading'),
        );
    }
    if (mapsPromise) return mapsPromise;

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
    mapsPromise = Promise.all([
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
            mapsPromise = null;
            throw error;
        });
    return mapsPromise;
}

function clearLayers(layers: MapLayers) {
    for (const area of layers.deliveryArea) area.setMap(null);
    layers.hqMarker?.setMap(null);
    layers.zagrebArea?.setMap(null);
}

function drawDeliveryZones(map: google.maps.Map, maps: GoogleMapsClient) {
    const deliveryBounds = new maps.LatLngBounds();
    const deliveryArea = deliveryRoadAreaPaths.map((path) => {
        const paths = path.map(([longitude, latitude]) => {
            const position = { lat: latitude, lng: longitude };
            deliveryBounds.extend(position);
            return position;
        });
        return new maps.Polygon({
            map,
            paths,
            clickable: false,
            fillColor: '#166534',
            fillOpacity: 0.1,
            strokeColor: '#166534',
            strokeOpacity: 0.9,
            strokeWeight: 2,
            zIndex: 1,
        });
    });
    const zagrebArea = new maps.Polygon({
        map,
        paths: zagrebBoundary.map(([longitude, latitude]) => ({
            lat: latitude,
            lng: longitude,
        })),
        clickable: false,
        fillColor: '#d97706',
        fillOpacity: 0.28,
        strokeColor: '#b45309',
        strokeOpacity: 1,
        strokeWeight: 2,
        zIndex: 2,
    });
    const hqMarker = new maps.Marker({
        map,
        position: grediceHqPosition,
        title: 'Gredice HQ – Ulica Julija Knifera 3',
        label: {
            text: 'G',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '700',
        },
        zIndex: 3,
    });
    return { deliveryArea, deliveryBounds, hqMarker, zagrebArea };
}

function fitDeliveryArea(
    map: google.maps.Map,
    bounds: google.maps.LatLngBounds,
) {
    map.fitBounds(bounds, 32);
}

export function DeliveryZoneMap({ apiKey }: { apiKey: string }) {
    const containerRef = useRef<HTMLElement>(null);
    const mapRef = useRef<google.maps.Map>(null);
    const layersRef = useRef<MapLayers>({
        deliveryArea: [],
        deliveryBounds: null,
        hqMarker: null,
        zagrebArea: null,
    });
    const [state, setState] = useState<MapState>(
        apiKey ? 'loading' : 'fallback',
    );

    useEffect(() => {
        if (!apiKey) return;
        let active = true;
        const handleAuthFailure = () => {
            if (active) setState('fallback');
        };
        window.addEventListener(googleMapsAuthFailureEvent, handleAuthFailure);

        async function initializeMap() {
            const element = containerRef.current;
            if (!element) return;
            try {
                const maps = await loadGoogleMaps(apiKey);
                if (!active) return;
                const map = new maps.Map(element, {
                    center: grediceHqPosition,
                    zoom: 8,
                    clickableIcons: false,
                    fullscreenControl: true,
                    gestureHandling: 'cooperative',
                    mapTypeControl: false,
                    streetViewControl: false,
                });
                const layers = drawDeliveryZones(map, maps);
                mapRef.current = map;
                layersRef.current = layers;
                fitDeliveryArea(map, layers.deliveryBounds);
                setState('ready');
            } catch {
                if (active) setState('fallback');
            }
        }

        void initializeMap();
        return () => {
            active = false;
            window.removeEventListener(
                googleMapsAuthFailureEvent,
                handleAuthFailure,
            );
            clearLayers(layersRef.current);
        };
    }, [apiKey]);

    const recenter = () => {
        const map = mapRef.current;
        const bounds = layersRef.current.deliveryBounds;
        if (map && bounds) fitDeliveryArea(map, bounds);
    };

    return (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted sm:aspect-[16/9]">
            <section
                ref={containerRef}
                aria-label="Interaktivna karta zona dostave"
                aria-busy={state === 'loading'}
                className={`absolute inset-0 transition-opacity ${state === 'ready' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            />
            {state === 'loading' ? (
                <div
                    role="status"
                    className="absolute inset-0 flex items-center justify-center bg-muted px-6 text-center text-sm text-muted-foreground"
                >
                    Učitavanje interaktivne karte zona dostave…
                </div>
            ) : null}
            {state === 'fallback' ? (
                <div
                    role="alert"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted px-6 text-center text-sm text-muted-foreground"
                >
                    <strong className="text-foreground">
                        Interaktivna karta trenutačno nije dostupna
                    </strong>
                    <span>
                        Besplatna dostava vrijedi na području Grada Zagreba, a
                        dostava uz nadoplatu unutar 100 km vožnje cestom od
                        Gredice HQ-a i unutar Hrvatske.
                    </span>
                    <a
                        href="https://maps.app.goo.gl/hJbidDQzhHWGCZwS6"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline"
                    >
                        Otvori Gredice HQ na Google Mapsu
                    </a>
                </div>
            ) : null}
            {state === 'ready' ? (
                <>
                    <div className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
                        <ul className="m-0 grid list-none gap-1 p-0">
                            <li className="flex items-center gap-2">
                                <span
                                    aria-hidden="true"
                                    className="size-3 rounded-sm border-2 border-amber-700 bg-amber-500/40"
                                />
                                Grad Zagreb – besplatno
                            </li>
                            <li className="flex items-center gap-2">
                                <span
                                    aria-hidden="true"
                                    className="size-3 rounded-full border-2 border-green-800 bg-green-700/20"
                                />
                                Do 100 km vožnje – uz nadoplatu, samo Hrvatska
                            </li>
                        </ul>
                    </div>
                    <Button
                        type="button"
                        variant="outlined"
                        size="sm"
                        className="absolute bottom-3 right-3 bg-background/95 shadow-sm backdrop-blur"
                        startDecorator={<MyLocation className="size-4" />}
                        onClick={recenter}
                    >
                        Centriraj
                    </Button>
                </>
            ) : null}
        </div>
    );
}
