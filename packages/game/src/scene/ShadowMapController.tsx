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
import {
    hasShadowDynamicCadenceChanged,
    resolveShadowMapRefreshTick,
} from './shadowMapScheduling';

const shadowSettleMs = 900;

export function ShadowMapController({
    dynamicRefreshMs,
    enabled,
    invalidationKey,
    settleKey,
}: {
    dynamicRefreshMs?: number;
    enabled: boolean;
    invalidationKey: string;
    settleKey?: string;
}) {
    const gl = useThree((state) => state.gl);
    const invalidate = useThree((state) => state.invalidate);
    const invalidationCountRef = useRef(0);
    const nextDynamicRefreshRef = useRef(0);
    const previousDynamicRefreshMsRef = useRef<number | undefined>(undefined);
    const settleUntilRef = useRef(0);
    const [shadowSettleGeneration, setShadowSettleGeneration] = useState(0);
    const [shadowSettling, setShadowSettling] = useState(false);
    const normalizedDynamicRefreshMs =
        enabled && typeof dynamicRefreshMs === 'number' && dynamicRefreshMs > 0
            ? dynamicRefreshMs
            : undefined;
    useSceneTimeInvalidation(enabled && shadowSettling);

    const settleShadows = useCallback(() => {
        if (!enabled) {
            return;
        }

        gl.shadowMap.enabled = true;
        gl.shadowMap.needsUpdate = true;
        settleUntilRef.current = performance.now() + shadowSettleMs;
        setShadowSettling(true);
        setShadowSettleGeneration((generation) => generation + 1);
        invalidate();
    }, [enabled, gl, invalidate]);

    useSceneResume(settleShadows);

    useLayoutEffect(() => {
        const previousAutoUpdate = gl.shadowMap.autoUpdate;
        const previousEnabled = gl.shadowMap.enabled;

        gl.shadowMap.enabled = enabled;
        gl.shadowMap.autoUpdate = !enabled;
        gl.shadowMap.needsUpdate = true;
        if (!enabled) {
            nextDynamicRefreshRef.current = 0;
            settleUntilRef.current = 0;
            setShadowSettling(false);
        }
        invalidate();
        updateGameProfileMetadata({
            shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
            shadowMapInvalidationCount: invalidationCountRef.current,
        });

        return () => {
            gl.shadowMap.autoUpdate = previousAutoUpdate;
            gl.shadowMap.enabled = previousEnabled;
            gl.shadowMap.needsUpdate = true;
        };
    }, [enabled, gl, invalidate]);

    useLayoutEffect(() => {
        void invalidationKey;

        if (!enabled) {
            return;
        }

        gl.shadowMap.enabled = true;
        gl.shadowMap.needsUpdate = true;
        invalidationCountRef.current += 1;
        invalidate();
        updateGameProfileMetadata({
            shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
            shadowMapInvalidationCount: invalidationCountRef.current,
        });
    }, [enabled, gl, invalidate, invalidationKey]);

    useLayoutEffect(() => {
        void settleKey;
        settleShadows();
    }, [settleKey, settleShadows]);

    useLayoutEffect(() => {
        const previousDynamicRefreshMs = previousDynamicRefreshMsRef.current;
        previousDynamicRefreshMsRef.current = normalizedDynamicRefreshMs;
        updateGameProfileMetadata({
            shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
            shadowMapDynamicRefreshMs: normalizedDynamicRefreshMs,
            shadowMapInvalidationCount: invalidationCountRef.current,
        });

        if (
            !hasShadowDynamicCadenceChanged(
                previousDynamicRefreshMs,
                normalizedDynamicRefreshMs,
            )
        ) {
            return;
        }

        nextDynamicRefreshRef.current = 0;
        if (!enabled) {
            return;
        }

        gl.shadowMap.enabled = true;
        gl.shadowMap.needsUpdate = true;
        invalidate();
    }, [enabled, gl, invalidate, normalizedDynamicRefreshMs]);

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

        const now = performance.now();
        const refreshTick = resolveShadowMapRefreshTick({
            dynamicRefreshMs: normalizedDynamicRefreshMs,
            nextDynamicRefreshAt: nextDynamicRefreshRef.current,
            now,
            settleUntil: settleUntilRef.current,
        });
        nextDynamicRefreshRef.current = refreshTick.nextDynamicRefreshAt;
        if (!refreshTick.shouldRefresh) {
            return;
        }

        gl.shadowMap.enabled = true;
        gl.shadowMap.needsUpdate = true;
    });

    return null;
}
