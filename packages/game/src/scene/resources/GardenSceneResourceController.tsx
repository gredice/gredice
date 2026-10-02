'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useId, useRef, useState } from 'react';
import type { GameAssetName } from '../../data/models';
import { resolveGameAssetModelUrl } from '../../utils/useGameGLTF';
import { updateGameProfileMetadata } from '../gameProfileMetadata';
import {
    useSceneFrameReceiptSubscription,
    useSceneRenderRequest,
} from '../SceneTime';
import {
    type GameAssetLoadPauseReason,
    GameAssetLoadScheduler,
} from './gameAssetLoadScheduler';
import {
    getGameResourceCache,
    isGameGLTFResident,
    loadGameGLTF,
} from './gameGLTFResources';
import {
    createGardenSceneManifestProfile,
    GardenSceneLifecycle,
} from './gardenSceneLifecycle';
import {
    type GardenSceneManifest,
    mergeGardenSceneLoadPlan,
} from './gardenSceneManifest';

/** Parallel prefetch slots; current-scene renderers also fetch on mount. */
const gameAssetLoadConcurrency = 4;
const idleCallbackTimeoutMs = 2_000;

function requestIdle(callback: () => void) {
    if (typeof window.requestIdleCallback === 'function') {
        return window.requestIdleCallback(callback, {
            timeout: idleCallbackTimeoutMs,
        });
    }
    return window.setTimeout(callback, 200);
}

function cancelIdle(handle: number) {
    if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(handle);
    }
    window.clearTimeout(handle);
}

/**
 * Drives exact manifest loading for the displayed and incoming gardens:
 * pins what either scene needs, prefetches through the bounded scheduler,
 * pauses on pagehide/hidden/context loss, and reports lifecycle states.
 */
export function GardenSceneResourceController({
    appBaseUrl,
    current,
    interactive,
    next,
}: {
    appBaseUrl: string;
    current: GardenSceneManifest | null;
    /** Scene transition finished and controls are mounted. */
    interactive: boolean;
    next: GardenSceneManifest | null;
}) {
    const owner = useId();
    const gl = useThree((state) => state.gl);
    const requestRender = useSceneRenderRequest();
    const subscribeFrameReceipt = useSceneFrameReceiptSubscription();
    const appBaseUrlRef = useRef(appBaseUrl);
    appBaseUrlRef.current = appBaseUrl;
    const [currentReady, setCurrentReady] = useState(false);
    const [lifecycle] = useState(
        () => new GardenSceneLifecycle(() => performance.now()),
    );
    const publishLifecycle = () => {
        const snapshot = lifecycle.getSnapshot();
        gl.domElement.dataset.gardenSceneLifecycle = snapshot.state;
        updateGameProfileMetadata({ gardenSceneLifecycle: snapshot });
    };
    const publishLifecycleRef = useRef(publishLifecycle);
    publishLifecycleRef.current = publishLifecycle;

    const schedulerRef = useRef<GameAssetLoadScheduler<GameAssetName> | null>(
        null,
    );
    const planRef = useRef<ReturnType<typeof mergeGardenSceneLoadPlan>>([]);

    // Created in an effect so StrictMode's simulated unmount disposes a
    // scheduler that is never reused.
    useEffect(() => {
        const scheduler = new GameAssetLoadScheduler<GameAssetName>({
            concurrency: gameAssetLoadConcurrency,
            isLoaded: (name) =>
                isGameGLTFResident(
                    resolveGameAssetModelUrl(appBaseUrlRef.current, name),
                ),
            load: (name) =>
                loadGameGLTF(
                    resolveGameAssetModelUrl(appBaseUrlRef.current, name),
                ),
            requestIdle,
            cancelIdle: (handle) => {
                if (typeof handle === 'number') cancelIdle(handle);
            },
            onChange: (snapshot) => {
                updateGameProfileMetadata({ sceneAssetLoads: snapshot });
                // Completions arrive asynchronously; React bails out when
                // readiness did not change.
                lifecycle.setCurrentReady(snapshot.currentReady);
                setCurrentReady(snapshot.currentReady);
            },
        });
        schedulerRef.current = scheduler;
        scheduler.setPlan(planRef.current);
        return () => {
            scheduler.dispose();
            if (schedulerRef.current === scheduler) schedulerRef.current = null;
        };
    }, [lifecycle]);

    useEffect(() => {
        if (lifecycle.setGarden(current?.gardenId ?? null)) {
            publishLifecycleRef.current();
        }
    }, [current?.gardenId, lifecycle]);

    useEffect(() => {
        const plan = mergeGardenSceneLoadPlan(current, next);
        const cache = getGameResourceCache();
        cache.setPins(
            owner,
            plan
                .filter((entry) => entry.pinned)
                .map((entry) =>
                    resolveGameAssetModelUrl(appBaseUrl, entry.name),
                ),
        );
        planRef.current = plan;
        schedulerRef.current?.setPlan(plan);
        updateGameProfileMetadata({
            gardenSceneManifest: createGardenSceneManifestProfile(
                current,
                next,
            ),
        });
    }, [appBaseUrl, current, next, owner]);

    useEffect(() => () => getGameResourceCache().setPins(owner, []), [owner]);

    useEffect(() => {
        if (currentReady) requestRender('scene-resources:current-ready');
        publishLifecycleRef.current();
    }, [currentReady, requestRender]);

    useEffect(() => {
        lifecycle.setInteractive(interactive);
        publishLifecycleRef.current();
    }, [interactive, lifecycle]);

    useEffect(
        () =>
            subscribeFrameReceipt(() => {
                const before = lifecycle.getSnapshot().state;
                lifecycle.frame();
                if (lifecycle.getSnapshot().state !== before) {
                    publishLifecycleRef.current();
                }
            }),
        [lifecycle, subscribeFrameReceipt],
    );

    useEffect(() => {
        const cache = getGameResourceCache();
        const canvas = gl.domElement;
        const setPaused = (reason: GameAssetLoadPauseReason, paused: boolean) =>
            schedulerRef.current?.setPaused(reason, paused);
        const handleVisibility = () => {
            setPaused('hidden', document.hidden);
            cache.setSuspended('hidden', document.hidden);
        };
        const handlePageHide = () => setPaused('pagehide', true);
        const handlePageShow = () => setPaused('pagehide', false);
        const handleContextLost = () => {
            // GPU objects are gone; keep CPU copies so three can re-upload.
            setPaused('context-lost', true);
            cache.setSuspended('context-lost', true);
            lifecycle.contextLost();
            publishLifecycleRef.current();
        };
        const handleContextRestored = () => {
            setPaused('context-lost', false);
            cache.setSuspended('context-lost', false);
            lifecycle.contextRestored();
            publishLifecycleRef.current();
            // three re-uploads geometry, textures, and programs lazily on the
            // next submitted frame; the Canvas DOM node stays mounted.
            requestRender('scene-resources:context-restored');
        };

        handleVisibility();
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('pageshow', handlePageShow);
        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('pageshow', handlePageShow);
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener(
                'webglcontextrestored',
                handleContextRestored,
            );
            cache.setSuspended('hidden', false);
            cache.setSuspended('context-lost', false);
            delete canvas.dataset.gardenSceneLifecycle;
        };
    }, [gl, lifecycle, requestRender]);

    return null;
}
