/// <reference types="google.maps" />

'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Button } from '@gredice/ui/Button';
import { MyLocation } from '@gredice/ui/icons';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
    type DeliveryMapCoordinate,
    type DeliveryMapData,
    type DeliveryMapPosition,
    decodeDeliveryMapPolyline,
    parseDeliveryMapData,
} from '../lib/deliveryMapData';

type MapState = 'loading' | 'ready' | 'fallback';

type MapLayers = {
    markers: google.maps.Marker[];
    polyline: google.maps.Polyline | null;
};

type GoogleMapsClient = {
    LatLngBounds: typeof google.maps.LatLngBounds;
    Map: typeof google.maps.Map;
    Marker: typeof google.maps.Marker;
    Polyline: typeof google.maps.Polyline;
    SymbolPath: typeof google.maps.SymbolPath;
};

declare global {
    interface Window {
        gm_authFailure?: () => void;
    }
}

const googleMapsAuthFailureEvent = 'gredice-google-maps-auth-failure';
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
    const load = Promise.all([
        importLibrary('maps'),
        importLibrary('marker'),
        importLibrary('core'),
    ]).then(([maps, marker, core]) => ({
        Map: maps.Map,
        Marker: marker.Marker,
        Polyline: maps.Polyline,
        LatLngBounds: core.LatLngBounds,
        SymbolPath: core.SymbolPath,
    }));
    mapsPromise = load.catch((error: unknown) => {
        mapsPromise = null;
        throw error;
    });
    return mapsPromise;
}

function versionedMapUrl(
    mapUrl: string,
    version: string | null,
    format?: 'json',
) {
    const separator = mapUrl.includes('?') ? '&' : '?';
    const versionQuery = `v=${encodeURIComponent(version ?? 'initial')}`;
    return `${mapUrl}${separator}${versionQuery}${format ? `&format=${format}` : ''}`;
}

function position(coordinate: DeliveryMapCoordinate): DeliveryMapPosition {
    return { lat: coordinate.latitude, lng: coordinate.longitude };
}

function markerIcon(maps: GoogleMapsClient, fillColor: string, scale: number) {
    return {
        path: maps.SymbolPath.CIRCLE,
        fillColor,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale,
    };
}

function clearLayers(layers: MapLayers) {
    for (const marker of layers.markers) marker.setMap(null);
    layers.polyline?.setMap(null);
}

function drawMapData(
    map: google.maps.Map,
    maps: GoogleMapsClient,
    data: DeliveryMapData,
): { layers: MapLayers; positions: DeliveryMapPosition[] } {
    const markers: google.maps.Marker[] = [];
    const positions: DeliveryMapPosition[] = [];

    if (data.driverLocation) {
        const driverPosition = position(data.driverLocation);
        positions.push(driverPosition);
        markers.push(
            new maps.Marker({
                map,
                position: driverPosition,
                title: 'Vozač',
                icon: markerIcon(maps, '#166534', 10),
                zIndex: 1000,
            }),
        );
    }

    data.pickupNodes.forEach((pickupNode, index) => {
        const pickupPosition = position(pickupNode);
        positions.push(pickupPosition);
        markers.push(
            new maps.Marker({
                map,
                position: pickupPosition,
                title: `Lokacija preuzimanja ${index + 1}`,
                label: {
                    text: 'P',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '700',
                },
                icon: markerIcon(maps, '#d97706', 10),
            }),
        );
    });

    for (const stop of data.stops) {
        const stopPosition = position(stop);
        positions.push(stopPosition);
        markers.push(
            new maps.Marker({
                map,
                position: stopPosition,
                title: `Dostavna stanica ${stop.sequence}`,
                label: {
                    text: String(stop.sequence),
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '700',
                },
                icon: markerIcon(maps, '#0f766e', 10),
            }),
        );
    }

    const routePositions = data.encodedPolyline
        ? decodeDeliveryMapPolyline(data.encodedPolyline)
        : [];
    positions.push(...routePositions);
    const polyline =
        routePositions.length > 1
            ? new maps.Polyline({
                  map,
                  path: routePositions,
                  geodesic: true,
                  strokeColor: '#166534',
                  strokeOpacity: 0.85,
                  strokeWeight: 5,
              })
            : null;

    return { layers: { markers, polyline }, positions };
}

function fitMap(
    map: google.maps.Map,
    maps: GoogleMapsClient,
    positions: DeliveryMapPosition[],
) {
    const firstPosition = positions[0];
    if (!firstPosition) return;
    if (positions.length === 1) {
        map.setCenter(firstPosition);
        map.setZoom(15);
        return;
    }
    const bounds = new maps.LatLngBounds();
    for (const mapPosition of positions) bounds.extend(mapPosition);
    map.fitBounds(bounds, 48);
}

export function DeliveryInteractiveMap({
    apiKey,
    mapUrl,
    version,
    title,
}: {
    apiKey: string;
    mapUrl: string;
    version: string | null;
    title: string;
}) {
    const containerRef = useRef<HTMLElement>(null);
    const mapRef = useRef<google.maps.Map>(null);
    const mapsRef = useRef<GoogleMapsClient>(null);
    const layersRef = useRef<MapLayers>({ markers: [], polyline: null });
    const positionsRef = useRef<DeliveryMapPosition[]>([]);
    const fittedMapUrlRef = useRef<string>(null);
    const [state, setState] = useState<MapState>(
        apiKey ? 'loading' : 'fallback',
    );
    const staticMapUrl = versionedMapUrl(mapUrl, version);

    useEffect(() => {
        if (!apiKey) return;
        const controller = new AbortController();
        let active = true;
        const handleAuthFailure = () => {
            if (active) setState('fallback');
        };
        window.addEventListener(googleMapsAuthFailureEvent, handleAuthFailure);

        async function refreshMap() {
            const element = containerRef.current;
            if (!element) return;
            try {
                const [maps, response] = await Promise.all([
                    loadGoogleMaps(apiKey),
                    fetch(versionedMapUrl(mapUrl, version, 'json'), {
                        cache: 'no-store',
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    }),
                ]);
                if (!response.ok) throw new Error('Delivery map data failed');
                const payload: unknown = await response.json();
                const data = parseDeliveryMapData(payload);
                if (!data) throw new Error('Delivery map data is invalid');
                if (!active) return;

                let map = mapRef.current;
                if (!map) {
                    map = new maps.Map(element, {
                        center: { lat: 45.815, lng: 15.982 },
                        zoom: 12,
                        clickableIcons: false,
                        fullscreenControl: true,
                        gestureHandling: 'cooperative',
                        mapTypeControl: false,
                        streetViewControl: false,
                    });
                    mapRef.current = map;
                    mapsRef.current = maps;
                }

                clearLayers(layersRef.current);
                const rendered = drawMapData(map, maps, data);
                layersRef.current = rendered.layers;
                positionsRef.current = rendered.positions;
                if (
                    fittedMapUrlRef.current !== mapUrl &&
                    rendered.positions.length > 0
                ) {
                    fitMap(map, maps, rendered.positions);
                    fittedMapUrlRef.current = mapUrl;
                }
                setState('ready');
            } catch (error) {
                if (
                    !active ||
                    (error instanceof DOMException &&
                        error.name === 'AbortError')
                ) {
                    return;
                }
                setState('fallback');
            }
        }

        void refreshMap();
        return () => {
            active = false;
            controller.abort();
            window.removeEventListener(
                googleMapsAuthFailureEvent,
                handleAuthFailure,
            );
        };
    }, [apiKey, mapUrl, version]);

    useEffect(
        () => () => {
            clearLayers(layersRef.current);
        },
        [],
    );

    const recenter = () => {
        const map = mapRef.current;
        const maps = mapsRef.current;
        if (map && maps) fitMap(map, maps, positionsRef.current);
    };

    return (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border bg-muted">
            <section
                ref={containerRef}
                aria-label={title}
                aria-hidden={state !== 'ready'}
                className={`absolute inset-0 transition-opacity ${state === 'ready' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            />
            {state === 'loading' ? (
                <div
                    role="status"
                    className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground"
                >
                    Učitavanje interaktivne karte…
                </div>
            ) : null}
            {state === 'fallback' ? (
                <Image
                    src={staticMapUrl}
                    alt={title}
                    fill
                    sizes="(max-width: 768px) 100vw, 720px"
                    className="object-cover"
                    unoptimized
                    priority
                />
            ) : null}
            {state === 'ready' ? (
                <Button
                    type="button"
                    variant="outlined"
                    size="sm"
                    className="absolute bottom-3 right-3 bg-background/95 shadow-sm backdrop-blur"
                    startDecorator={<MyLocation className="size-4" />}
                    onClick={recenter}
                >
                    Centriraj kartu
                </Button>
            ) : null}
        </div>
    );
}
