'use client';

import { useEffect, useRef, useState } from 'react';

export type DriverTrackingState =
    | 'inactive'
    | 'requesting'
    | 'active'
    | 'denied'
    | 'unavailable'
    | 'error';

const minimumUploadIntervalMs = 10_000;

export function useDriverTracking(runId: string | null) {
    const [state, setState] = useState<DriverTrackingState>('inactive');
    const lastUploadAt = useRef(0);

    useEffect(() => {
        if (!runId) {
            setState('inactive');
            return;
        }
        if (!('geolocation' in navigator)) {
            setState('unavailable');
            return;
        }

        setState('requesting');
        lastUploadAt.current = 0;
        let disposed = false;
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                if (disposed) return;
                setState('active');
                const now = Date.now();
                if (now - lastUploadAt.current < minimumUploadIntervalMs) {
                    return;
                }
                lastUploadAt.current = now;
                void fetch(`/api/driver/runs/${runId}/location`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        recordedAt: new Date(position.timestamp).toISOString(),
                    }),
                })
                    .then((response) => {
                        if (!disposed && !response.ok) setState('error');
                    })
                    .catch(() => {
                        if (!disposed) setState('error');
                    });
            },
            (error) => {
                if (!disposed) {
                    setState(
                        error.code === error.PERMISSION_DENIED
                            ? 'denied'
                            : 'error',
                    );
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5_000,
                timeout: 20_000,
            },
        );

        return () => {
            disposed = true;
            navigator.geolocation.clearWatch(watchId);
        };
    }, [runId]);

    return state;
}
