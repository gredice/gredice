'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type DriverRouteWakeLockStatus =
    | 'inactive'
    | 'unsupported'
    | 'off'
    | 'requesting'
    | 'active'
    | 'paused'
    | 'error';

export type DriverRouteWakeLockState = {
    status: DriverRouteWakeLockStatus;
    consented: boolean;
    documentVisible: boolean;
    enable: () => void;
    disable: () => void;
    retry: () => void;
};

type WakeLockControls = {
    runId: string;
    enable: () => void;
    disable: () => void;
    retry: () => void;
};

type WakeLockViewState = Pick<
    DriverRouteWakeLockState,
    'status' | 'consented' | 'documentVisible'
>;

const inactiveWakeLockState: WakeLockViewState = {
    status: 'inactive',
    consented: false,
    documentVisible: true,
};

export function useDriverRouteWakeLock({
    runId,
}: {
    runId: string | null;
}): DriverRouteWakeLockState {
    const [viewState, setViewState] = useState<WakeLockViewState>(
        inactiveWakeLockState,
    );
    const controlsRef = useRef<WakeLockControls | null>(null);

    const enable = useCallback(() => controlsRef.current?.enable(), []);
    const disable = useCallback(() => controlsRef.current?.disable(), []);
    const retry = useCallback(() => controlsRef.current?.retry(), []);

    useEffect(() => {
        if (!runId) {
            controlsRef.current = null;
            setViewState(inactiveWakeLockState);
            return;
        }

        let disposed = false;
        let consented = false;
        let requesting = false;
        let requestGeneration = 0;
        let sentinel: WakeLockSentinel | null = null;
        let sentinelReleaseListener: (() => void) | null = null;
        const wakeLock = 'wakeLock' in navigator ? navigator.wakeLock : null;
        const supported = wakeLock !== null;
        let state: WakeLockViewState = {
            status: supported ? 'off' : 'unsupported',
            consented: false,
            documentVisible: document.visibilityState === 'visible',
        };
        setViewState(state);

        const publish = (patch: Partial<WakeLockViewState>) => {
            if (disposed) return;
            state = { ...state, ...patch };
            setViewState(state);
        };

        const releaseCurrentSentinel = async () => {
            const current = sentinel;
            const releaseListener = sentinelReleaseListener;
            sentinel = null;
            sentinelReleaseListener = null;
            if (!current) return;
            if (releaseListener) {
                current.removeEventListener('release', releaseListener);
            }
            if (current.released) return;
            try {
                await current.release();
            } catch {
                // The browser may have released the sentinel concurrently.
            }
        };

        const acquire = async () => {
            if (
                disposed ||
                !supported ||
                !consented ||
                document.visibilityState !== 'visible'
            ) {
                if (consented && document.visibilityState !== 'visible') {
                    publish({ status: 'paused', documentVisible: false });
                }
                return;
            }
            if (sentinel && !sentinel.released) {
                publish({ status: 'active', documentVisible: true });
                return;
            }
            if (requesting) return;

            requesting = true;
            const generation = ++requestGeneration;
            publish({ status: 'requesting', documentVisible: true });
            try {
                const requestedSentinel = await wakeLock.request('screen');
                if (
                    disposed ||
                    generation !== requestGeneration ||
                    !consented ||
                    document.visibilityState !== 'visible'
                ) {
                    try {
                        await requestedSentinel.release();
                    } catch {
                        // A stale request must not retain the screen lock.
                    }
                    return;
                }
                requesting = false;

                const handleRelease = () => {
                    if (sentinel !== requestedSentinel) return;
                    sentinel = null;
                    sentinelReleaseListener = null;
                    if (disposed || !consented) return;
                    const documentVisible =
                        document.visibilityState === 'visible';
                    if (documentVisible) consented = false;
                    publish({
                        status: documentVisible ? 'error' : 'paused',
                        consented: documentVisible ? false : consented,
                        documentVisible,
                    });
                };
                sentinel = requestedSentinel;
                sentinelReleaseListener = handleRelease;
                requestedSentinel.addEventListener('release', handleRelease, {
                    once: true,
                });
                publish({ status: 'active', documentVisible: true });
            } catch {
                if (disposed || generation !== requestGeneration) return;
                requesting = false;
                const documentVisible = document.visibilityState === 'visible';
                if (documentVisible) consented = false;
                publish({
                    status: documentVisible ? 'error' : 'paused',
                    consented: documentVisible ? false : consented,
                    documentVisible,
                });
            }
        };

        const suspend = () => {
            requestGeneration += 1;
            requesting = false;
            publish({
                status: consented
                    ? 'paused'
                    : supported
                      ? 'off'
                      : 'unsupported',
                documentVisible: false,
            });
            void releaseCurrentSentinel();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') {
                suspend();
                return;
            }
            publish({
                status: consented
                    ? 'requesting'
                    : supported
                      ? 'off'
                      : 'unsupported',
                documentVisible: true,
            });
            if (consented) void acquire();
        };
        const handlePageHide = () => suspend();
        const handlePageShow = () => {
            if (document.visibilityState !== 'visible') return;
            publish({ documentVisible: true });
            if (consented) void acquire();
        };

        controlsRef.current = {
            runId,
            enable: () => {
                if (!supported) return;
                consented = true;
                publish({ consented: true });
                void acquire();
            },
            disable: () => {
                consented = false;
                requestGeneration += 1;
                requesting = false;
                publish({ status: 'off', consented: false });
                void releaseCurrentSentinel();
            },
            retry: () => {
                if (!supported) return;
                consented = true;
                publish({ consented: true });
                void acquire();
            },
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('pageshow', handlePageShow);

        return () => {
            disposed = true;
            consented = false;
            requestGeneration += 1;
            requesting = false;
            if (controlsRef.current?.runId === runId) {
                controlsRef.current = null;
            }
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('pageshow', handlePageShow);
            void releaseCurrentSentinel();
        };
    }, [runId]);

    return { ...viewState, enable, disable, retry };
}
