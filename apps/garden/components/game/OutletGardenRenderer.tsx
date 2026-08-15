'use client';

import { useGameAnalytics } from '@gredice/game/analytics';
import {
    type OutletGardenCommerceController,
    useOutletGardenCommerce,
} from '@gredice/game/outlet-garden-commerce';
import type { OutletGardenFallbackReason } from '@gredice/game/outlet-garden-list';
import dynamic from 'next/dynamic';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useCallback, useEffect, useRef, useState } from 'react';
import LoginModal from '../auth/LoginModal';
import { GardenRouteLoading } from './GardenRouteLoading';
import { OutletGardenSceneErrorBoundary } from './OutletGardenSceneErrorBoundary';

const OutletGardenViewer = dynamic(
    () =>
        import('@gredice/game/outlet-garden').then(
            (module) => module.OutletGardenViewer,
        ),
    { loading: () => <GardenRouteLoading />, ssr: false },
);

const OutletGardenBrowserViewer = dynamic(
    () =>
        import('@gredice/game/outlet-garden-list').then(
            (module) => module.OutletGardenBrowserViewer,
        ),
    { loading: () => <GardenRouteLoading />, ssr: false },
);

type OutletGardenRendererMode = 'checking' | 'list' | 'three-dimensional';

const outletGardenListPreferenceKey = 'gredice-outlet-garden-list-view';
const outletGardenSceneReadyTimeoutMs = 20_000;

function supportsWebGL() {
    try {
        const canvas = document.createElement('canvas');
        return Boolean(
            canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
        );
    } catch {
        return false;
    }
}

function selectedOfferId() {
    const value = new URLSearchParams(window.location.search).get('ponuda');
    return value && /^[1-9]\d*$/u.test(value) ? Number(value) : null;
}

function rendererContext() {
    return {
        device_class: window.innerWidth < 768 ? 'mobile' : 'desktop',
        input_mode: navigator.maxTouchPoints > 0 ? 'touch' : 'pointer',
        selected_offer_id: selectedOfferId(),
    };
}

function listPreferenceEnabled() {
    try {
        return sessionStorage.getItem(outletGardenListPreferenceKey) === '1';
    } catch {
        return false;
    }
}

function setListPreference(enabled: boolean) {
    try {
        if (enabled) {
            sessionStorage.setItem(outletGardenListPreferenceKey, '1');
        } else {
            sessionStorage.removeItem(outletGardenListPreferenceKey);
        }
    } catch {
        // Session storage is optional; the current renderer still switches.
    }
}

export function OutletGardenRenderer() {
    const { track } = useGameAnalytics();
    const [mode, setMode] = useState<OutletGardenRendererMode>('checking');
    const [fallbackReason, setFallbackReason] =
        useState<OutletGardenFallbackReason>('user');
    const [focusThreeDimensionalOnMount, setFocusThreeDimensionalOnMount] =
        useState(false);
    const initializedRef = useRef(false);
    const sceneReadyRef = useRef(false);
    const failureHandledRef = useRef(false);
    const sceneStartedAtRef = useRef(Date.now());
    const [selectedOfferId] = useQueryState('ponuda', parseAsInteger);
    const [reservationIntent, setReservationIntent] = useQueryState(
        'rezervacija',
        parseAsInteger,
    );
    const [loginOpen, setLoginOpen] = useState(false);
    const renderer = mode === 'list' ? 'list' : 'webgl';
    const updateReservationIntent = useCallback(
        (requested: boolean) => {
            void setReservationIntent(requested ? 1 : null);
        },
        [setReservationIntent],
    );
    const commerce: OutletGardenCommerceController = useOutletGardenCommerce({
        enabled: true,
        onReservationIntentChange: updateReservationIntent,
        renderer,
        requested: reservationIntent === 1,
        selectedOfferId,
    });

    useEffect(() => {
        if (selectedOfferId === null && reservationIntent !== null) {
            void setReservationIntent(null);
        }
    }, [reservationIntent, selectedOfferId, setReservationIntent]);

    const requestAuthentication = useCallback(() => {
        if (selectedOfferId === null) {
            return;
        }
        void setReservationIntent(1);
        setLoginOpen(true);
    }, [selectedOfferId, setReservationIntent]);

    const showList = useCallback(
        (reason: OutletGardenFallbackReason, remember: boolean) => {
            if (failureHandledRef.current && reason !== 'user') {
                return;
            }

            failureHandledRef.current = reason !== 'user';
            sceneReadyRef.current = false;
            setFallbackReason(reason);
            setMode('list');
            if (remember) {
                setListPreference(true);
            }

            const properties = {
                fallback_reason: reason,
                scene_elapsed_ms: Math.max(
                    0,
                    Date.now() - sceneStartedAtRef.current,
                ),
                ...rendererContext(),
            };
            if (reason !== 'user') {
                track('game_outlet_garden_scene_failed', {
                    ...properties,
                    failure_reason: reason,
                    renderer: 'webgl',
                });
            }
            track('game_outlet_garden_fallback_used', {
                ...properties,
                renderer: 'list',
            });
        },
        [track],
    );

    const tryThreeDimensional = useCallback(() => {
        if (!supportsWebGL()) {
            showList('unsupported_webgl', false);
            return;
        }

        failureHandledRef.current = false;
        sceneReadyRef.current = false;
        sceneStartedAtRef.current = Date.now();
        setFocusThreeDimensionalOnMount(true);
        setListPreference(false);
        setMode('three-dimensional');
    }, [showList]);

    useEffect(() => {
        if (initializedRef.current) {
            return;
        }
        initializedRef.current = true;

        if (listPreferenceEnabled()) {
            showList('user', false);
            return;
        }

        if (!supportsWebGL()) {
            showList('unsupported_webgl', false);
            return;
        }

        sceneStartedAtRef.current = Date.now();
        setMode('three-dimensional');
    }, [showList]);

    useEffect(() => {
        if (mode !== 'three-dimensional') {
            return;
        }

        const timeout = window.setTimeout(() => {
            if (!sceneReadyRef.current) {
                showList('scene_ready_timeout', false);
            }
        }, outletGardenSceneReadyTimeoutMs);

        return () => window.clearTimeout(timeout);
    }, [mode, showList]);

    let content = <GardenRouteLoading />;
    if (mode === 'list') {
        content = (
            <OutletGardenBrowserViewer
                commerce={commerce}
                fallbackReason={fallbackReason}
                onAuthenticationRequired={requestAuthentication}
                onUse3D={
                    fallbackReason === 'unsupported_webgl'
                        ? undefined
                        : tryThreeDimensional
                }
            />
        );
    } else if (mode === 'three-dimensional') {
        content = (
            <OutletGardenSceneErrorBoundary
                onError={() => showList('scene_load_error', false)}
            >
                <OutletGardenViewer
                    commerce={commerce}
                    focusOnMount={focusThreeDimensionalOnMount}
                    onAuthenticationRequired={requestAuthentication}
                    onSceneFailure={(reason) => showList(reason, false)}
                    onSceneReady={() => {
                        sceneReadyRef.current = true;
                    }}
                    onUseListFallback={() => showList('user', true)}
                    sceneStartedAt={sceneStartedAtRef.current}
                />
            </OutletGardenSceneErrorBoundary>
        );
    }

    const returnTo =
        selectedOfferId === null
            ? '/outlet'
            : `/outlet?ponuda=${selectedOfferId.toString()}&rezervacija=1`;

    return (
        <>
            {content}
            <LoginModal
                dismissible
                onAuthenticated={() => {
                    setLoginOpen(false);
                    void commerce.refreshAuthentication();
                }}
                onOpenChange={(open) => {
                    setLoginOpen(open);
                }}
                open={loginOpen}
                returnTo={returnTo}
            />
        </>
    );
}
