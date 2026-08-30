'use client';

import { useCallback, useEffect, useRef } from 'react';

export type GardenStructureBuildModeHistoryBackDisposition = 'close' | 'retain';

const historyStateKey = '__grediceGardenStructureBuildMode';

function historyStateWithMarker(marker: string) {
    const current = window.history.state;
    return {
        ...(typeof current === 'object' && current !== null ? current : {}),
        [historyStateKey]: marker,
    };
}

export function useGardenStructureBuildModeHistoryGuard({
    active,
    onBack,
}: {
    active: boolean;
    onBack: () => GardenStructureBuildModeHistoryBackDisposition;
}) {
    const markerRef = useRef(`garden-structure-${crypto.randomUUID()}`);
    const guardArmedRef = useRef(false);
    const intentionalPopRef = useRef(false);
    const onBackRef = useRef(onBack);
    onBackRef.current = onBack;

    const armGuard = useCallback(() => {
        if (guardArmedRef.current) {
            return;
        }
        window.history.pushState(
            historyStateWithMarker(markerRef.current),
            '',
            window.location.href,
        );
        guardArmedRef.current = true;
    }, []);

    const releaseGuard = useCallback(() => {
        if (!guardArmedRef.current) {
            return;
        }
        intentionalPopRef.current = true;
        guardArmedRef.current = false;
        window.history.back();
    }, []);

    useEffect(() => {
        if (active) {
            armGuard();
        } else {
            releaseGuard();
        }
    }, [active, armGuard, releaseGuard]);

    useEffect(() => {
        if (!active) {
            return;
        }
        const handlePopState = () => {
            if (intentionalPopRef.current) {
                intentionalPopRef.current = false;
                return;
            }
            guardArmedRef.current = false;
            if (onBackRef.current() === 'retain') {
                armGuard();
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [active, armGuard]);

    return releaseGuard;
}
