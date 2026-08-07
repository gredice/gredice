'use client';

import type {
    GardenAvatarPresenceState,
    GardenVisitorPresence,
    GardenVisitorPresenceController,
} from '@gredice/game';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const visitorSessionStorageKey = 'gredice-public-garden-visitor-id';
const presenceRefreshMs = 500;
const visitorIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isGardenVisitorPresence(
    value: unknown,
): value is GardenVisitorPresence {
    if (!isRecord(value)) {
        return false;
    }
    const position = value.position;
    return (
        typeof value.id === 'string' &&
        Array.isArray(position) &&
        position.length === 3 &&
        position.every(isFiniteNumber) &&
        isFiniteNumber(value.yaw) &&
        isFiniteNumber(value.movingSpeed) &&
        isFiniteNumber(value.crouchAmount) &&
        isFiniteNumber(value.headPitch) &&
        typeof value.grounded === 'boolean' &&
        (value.view === 'overview' ||
            value.view === 'third-person' ||
            value.view === 'first-person') &&
        isFiniteNumber(value.updatedAt)
    );
}

function readVisitors(value: unknown) {
    if (!isRecord(value) || !Array.isArray(value.visitors)) {
        return [];
    }
    return value.visitors.filter(isGardenVisitorPresence);
}

function getVisitorId() {
    const existing = window.sessionStorage.getItem(visitorSessionStorageKey);
    if (existing && visitorIdPattern.test(existing)) {
        return existing;
    }
    const visitorId = window.crypto.randomUUID();
    window.sessionStorage.setItem(visitorSessionStorageKey, visitorId);
    return visitorId;
}

export function usePublicGardenVisitorPresence(
    gardenId: number,
): GardenVisitorPresenceController {
    const latestPresenceRef = useRef<GardenAvatarPresenceState | null>(null);
    const [visitorId, setVisitorId] = useState<string | null>(null);
    const [visitors, setVisitors] = useState<GardenVisitorPresence[]>([]);

    const onLocalPresenceChange = useCallback(
        (presence: GardenAvatarPresenceState) => {
            latestPresenceRef.current = presence;
        },
        [],
    );

    useEffect(() => {
        setVisitorId(getVisitorId());
    }, []);

    useEffect(() => {
        if (!visitorId) {
            return;
        }

        const endpoint = `/api/gredice/api/gardens/${gardenId.toString()}/public/visitors`;
        const abortController = new AbortController();
        let active = true;
        let timeout: ReturnType<typeof setTimeout> | undefined;

        const schedule = (delay = presenceRefreshMs) => {
            timeout = setTimeout(() => void synchronize(), delay);
        };
        const synchronize = async () => {
            const presence = latestPresenceRef.current;
            if (!presence || document.hidden) {
                schedule(document.hidden ? 1_500 : 100);
                return;
            }

            try {
                const response = await fetch(endpoint, {
                    body: JSON.stringify({
                        action: 'presence',
                        ...presence,
                        visitorId,
                    }),
                    cache: 'no-store',
                    headers: { 'content-type': 'application/json' },
                    method: 'POST',
                    signal: abortController.signal,
                });
                if (response.ok) {
                    const body: unknown = await response.json();
                    if (active) {
                        setVisitors(readVisitors(body));
                    }
                }
            } catch {
                // The local avatar stays playable when live presence is unavailable.
                if (active) {
                    const staleBefore = Date.now() - 15_000;
                    setVisitors((current) =>
                        current.filter(
                            (visitor) => visitor.updatedAt >= staleBefore,
                        ),
                    );
                }
            } finally {
                if (active) {
                    schedule();
                }
            }
        };

        const leaveBody = JSON.stringify({ action: 'leave', visitorId });
        const leave = () => {
            navigator.sendBeacon(
                endpoint,
                new Blob([leaveBody], { type: 'application/json' }),
            );
        };

        setVisitors([]);
        schedule(0);
        window.addEventListener('pagehide', leave);
        return () => {
            active = false;
            if (timeout) {
                clearTimeout(timeout);
            }
            abortController.abort();
            window.removeEventListener('pagehide', leave);
            leave();
            setVisitors([]);
        };
    }, [gardenId, visitorId]);

    return useMemo(
        () => ({
            localVisitorId: visitorId ?? 'visitor-initializing',
            onLocalPresenceChange,
            visitors,
        }),
        [onLocalPresenceChange, visitorId, visitors],
    );
}
