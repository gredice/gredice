'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import { useSceneResume, useSceneTimeInvalidation } from './SceneTime';
import { requestPrimaryShadowMapRefresh } from './shadowMapScheduling';

const shadowSettleMs = 900;

export function ShadowMapController({
    enabled,
    invalidationKey,
    settleKey,
}: {
    enabled: boolean;
    invalidationKey: string;
    settleKey?: string;
}) {
    const gl = useThree((state) => state.gl);
    const invalidate = useThree((state) => state.invalidate);
    const invalidationCountRef = useRef(0);
    const refreshCountRef = useRef(0);
    const settleUntilRef = useRef(0);
    const [shadowSettleGeneration, setShadowSettleGeneration] = useState(0);
    const [shadowSettling, setShadowSettling] = useState(false);
    useSceneTimeInvalidation(enabled && shadowSettling);

    const reportShadowMapState = useCallback(() => {
        updateGameProfileMetadata({
            animatedCasterShadowRefreshCount: 0,
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
                invalidate();
            }
            reportShadowMapState();
        },
        [enabled, gl, invalidate, reportShadowMapState],
    );

    const settleShadows = useCallback(() => {
        if (!enabled) {
            return;
        }

        requestShadowRefresh(true);
        settleUntilRef.current = performance.now() + shadowSettleMs;
        setShadowSettling(true);
        setShadowSettleGeneration((generation) => generation + 1);
    }, [enabled, requestShadowRefresh]);

    useSceneResume(settleShadows);

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
        if (!enabled) {
            settleUntilRef.current = 0;
            setShadowSettling(false);
        }
        reportShadowMapState();

        return () => {
            gl.shadowMap.autoUpdate = previousAutoUpdate;
            gl.shadowMap.enabled = previousEnabled;
            gl.shadowMap.needsUpdate = true;
        };
    }, [enabled, gl, reportShadowMapState, requestShadowRefresh]);

    useLayoutEffect(() => {
        void invalidationKey;

        if (!enabled) {
            return;
        }

        invalidationCountRef.current += 1;
        requestShadowRefresh(true);
    }, [enabled, invalidationKey, requestShadowRefresh]);

    useLayoutEffect(() => {
        void settleKey;
        settleShadows();
    }, [settleKey, settleShadows]);

    useEffect(() => {
        void shadowSettleGeneration;

        if (!enabled || !shadowSettling) {
            return;
        }

        const timeout = window.setTimeout(
            () => {
                setShadowSettling(false);
            },
            Math.max(0, settleUntilRef.current - performance.now()),
        );

        return () => window.clearTimeout(timeout);
    }, [enabled, shadowSettleGeneration, shadowSettling]);

    useFrame(() => {
        if (!enabled) {
            return;
        }

        if (performance.now() > settleUntilRef.current) {
            return;
        }

        requestShadowRefresh(false);
    });

    return null;
}
