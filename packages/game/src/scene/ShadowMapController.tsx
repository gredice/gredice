'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import { useSceneRenderRequest, useSceneResume } from './SceneTime';
import {
    consumeDeferredShadowRefresh,
    createDeferredShadowRefreshState,
    requestPrimaryShadowMapRefresh,
    transitionDeferredShadowRefresh,
} from './shadowMapScheduling';

export function ShadowMapController({
    activePlacementCount = 0,
    enabled,
    geometryKey,
    invalidationKey,
}: {
    activePlacementCount?: number;
    enabled: boolean;
    geometryKey?: string;
    invalidationKey: string;
}) {
    const gl = useThree((state) => state.gl);
    const requestRender = useSceneRenderRequest();
    const activePlacementCountRef = useRef(activePlacementCount);
    activePlacementCountRef.current = activePlacementCount;
    const deferredRefreshRef = useRef(
        createDeferredShadowRefreshState(activePlacementCount),
    );
    const deferredChangeCountRef = useRef(0);
    const invalidationCountRef = useRef(0);
    const placementFlushCountRef = useRef(0);
    const previousGeometryKeyRef = useRef(geometryKey);
    const previousInvalidationKeyRef = useRef(invalidationKey);
    const refreshCountRef = useRef(0);

    const reportShadowMapState = useCallback(() => {
        updateGameProfileMetadata({
            animatedCasterShadowRefreshCount: 0,
            placementShadowActiveCount:
                deferredRefreshRef.current.activePlacementCount,
            placementShadowDeferredChangeCount: deferredChangeCountRef.current,
            placementShadowFlushCount: placementFlushCountRef.current,
            primaryShadowRefreshCount: refreshCountRef.current,
            shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
            shadowMapDynamicRefreshMs: 0,
            shadowMapInvalidationCount: invalidationCountRef.current,
        });
    }, [gl]);

    const requestShadowRefresh = useCallback(
        (invalidateFrame: boolean) => {
            if (!enabled) {
                return;
            }

            refreshCountRef.current = requestPrimaryShadowMapRefresh(
                gl.shadowMap,
                enabled,
                refreshCountRef.current,
            );
            if (invalidateFrame) {
                requestRender('primary-shadow-refresh');
            }
            reportShadowMapState();
        },
        [enabled, gl, reportShadowMapState, requestRender],
    );

    const queueDeferredRefresh = useCallback(
        ({
            activeCount = activePlacementCountRef.current,
            forceDirty = false,
            geometryChanged = false,
        }: {
            activeCount?: number;
            forceDirty?: boolean;
            geometryChanged?: boolean;
        }) => {
            const transition = transitionDeferredShadowRefresh(
                deferredRefreshRef.current,
                {
                    activePlacementCount: activeCount,
                    forceDirty,
                    geometryChanged,
                },
            );
            deferredRefreshRef.current = transition.state;
            deferredChangeCountRef.current +=
                transition.deferredChangeCountDelta;
            if (enabled && transition.shouldInvalidate) {
                requestRender('deferred-shadow-refresh');
            }
            reportShadowMapState();
        },
        [enabled, reportShadowMapState, requestRender],
    );

    const queueResumeRefresh = useCallback(() => {
        if (enabled) {
            queueDeferredRefresh({ forceDirty: true });
        }
    }, [enabled, queueDeferredRefresh]);
    useSceneResume(queueResumeRefresh);

    useLayoutEffect(() => {
        const previousAutoUpdate = gl.shadowMap.autoUpdate;
        const previousEnabled = gl.shadowMap.enabled;

        gl.shadowMap.enabled = enabled;
        gl.shadowMap.autoUpdate = !enabled;
        if (enabled) {
            requestShadowRefresh(true);
        } else {
            gl.shadowMap.needsUpdate = true;
        }
        deferredRefreshRef.current = createDeferredShadowRefreshState(
            activePlacementCountRef.current,
        );
        reportShadowMapState();

        return () => {
            gl.shadowMap.autoUpdate = previousAutoUpdate;
            gl.shadowMap.enabled = previousEnabled;
            gl.shadowMap.needsUpdate = true;
        };
    }, [enabled, gl, reportShadowMapState, requestShadowRefresh]);

    useLayoutEffect(() => {
        const invalidationChanged =
            previousInvalidationKeyRef.current !== invalidationKey;
        const geometryChanged = previousGeometryKeyRef.current !== geometryKey;
        previousInvalidationKeyRef.current = invalidationKey;
        previousGeometryKeyRef.current = geometryKey;
        if (enabled && invalidationChanged) {
            invalidationCountRef.current += 1;
        }
        queueDeferredRefresh({
            activeCount: activePlacementCount,
            forceDirty: invalidationChanged,
            geometryChanged,
        });
    }, [
        activePlacementCount,
        enabled,
        geometryKey,
        invalidationKey,
        queueDeferredRefresh,
    ]);

    useFrame(() => {
        if (!enabled) {
            return;
        }

        const consumption = consumeDeferredShadowRefresh(
            deferredRefreshRef.current,
        );
        if (!consumption.shouldRefresh) {
            return;
        }

        deferredRefreshRef.current = consumption.state;
        if (consumption.placementFlush) {
            placementFlushCountRef.current += 1;
        }
        requestShadowRefresh(false);
    });

    return null;
}
