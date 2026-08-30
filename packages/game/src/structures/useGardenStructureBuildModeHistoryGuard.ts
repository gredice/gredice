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
    const releasePendingRef = useRef(false);
    const activeRef = useRef(active);
    const onBackRef = useRef(onBack);
    activeRef.current = active;
    onBackRef.current = onBack;

    const armGuard = useCallback(() => {
        if (guardArmedRef.current || releasePendingRef.current) {
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
        const currentHistoryState = window.history.state;
        const markerIsCurrent =
            typeof currentHistoryState === 'object' &&
            currentHistoryState !== null &&
            currentHistoryState[historyStateKey] === markerRef.current;
        guardArmedRef.current = false;
        if (!markerIsCurrent) {
            releasePendingRef.current = false;
            return;
        }
        releasePendingRef.current = true;
        window.history.back();
    }, []);

    useEffect(() => {
        if (active) {
            armGuard();
        } else {
            releaseGuard();
        }
    }, [active, armGuard, releaseGuard]);

    useEffect(
        () => () => {
            activeRef.current = false;
            releaseGuard();
        },
        [releaseGuard],
    );

    useEffect(() => {
        const handlePopState = () => {
            if (releasePendingRef.current) {
                releasePendingRef.current = false;
                if (activeRef.current) {
                    armGuard();
                }
                return;
            }
            if (!activeRef.current) {
                return;
            }
            guardArmedRef.current = false;
            if (onBackRef.current() === 'retain') {
                armGuard();
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [armGuard]);

    return releaseGuard;
}
