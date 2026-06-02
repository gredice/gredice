'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { updateGameProfileMetadata } from './gameProfileMetadata';

const shadowSettleMs = 900;

export function ShadowMapController({
    dynamicRefreshMs,
    enabled,
    invalidationKey,
}: {
    dynamicRefreshMs?: number;
    enabled: boolean;
    invalidationKey: string;
}) {
    const gl = useThree((state) => state.gl);
    const invalidationCountRef = useRef(0);
    const nextDynamicRefreshRef = useRef(0);
    const settleUntilRef = useRef(0);
    const normalizedDynamicRefreshMs =
        enabled && typeof dynamicRefreshMs === 'number' && dynamicRefreshMs > 0
            ? dynamicRefreshMs
            : undefined;

    useLayoutEffect(() => {
        const previousAutoUpdate = gl.shadowMap.autoUpdate;
        const previousEnabled = gl.shadowMap.enabled;

        gl.shadowMap.enabled = enabled;
        gl.shadowMap.autoUpdate = !enabled;
        gl.shadowMap.needsUpdate = true;
        updateGameProfileMetadata({
            shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
            shadowMapDynamicRefreshMs: normalizedDynamicRefreshMs,
            shadowMapInvalidationCount: invalidationCountRef.current,
        });

        return () => {
            gl.shadowMap.autoUpdate = previousAutoUpdate;
            gl.shadowMap.enabled = previousEnabled;
            gl.shadowMap.needsUpdate = true;
        };
    }, [enabled, gl, normalizedDynamicRefreshMs]);

    useLayoutEffect(() => {
        void invalidationKey;

        if (!enabled) {
            updateGameProfileMetadata({
                shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
                shadowMapDynamicRefreshMs: normalizedDynamicRefreshMs,
                shadowMapInvalidationCount: invalidationCountRef.current,
            });
            return;
        }

        gl.shadowMap.enabled = true;
        gl.shadowMap.needsUpdate = true;
        nextDynamicRefreshRef.current = 0;
        settleUntilRef.current = performance.now() + shadowSettleMs;
        invalidationCountRef.current += 1;
        updateGameProfileMetadata({
            shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
            shadowMapDynamicRefreshMs: normalizedDynamicRefreshMs,
            shadowMapInvalidationCount: invalidationCountRef.current,
        });
    }, [enabled, gl, invalidationKey, normalizedDynamicRefreshMs]);

    useFrame(() => {
        if (!enabled) {
            return;
        }

        const now = performance.now();
        const shouldRefreshDynamic =
            normalizedDynamicRefreshMs !== undefined &&
            now >= nextDynamicRefreshRef.current;

        if (now > settleUntilRef.current && !shouldRefreshDynamic) {
            return;
        }

        gl.shadowMap.enabled = true;
        gl.shadowMap.needsUpdate = true;

        if (shouldRefreshDynamic && normalizedDynamicRefreshMs !== undefined) {
            nextDynamicRefreshRef.current = now + normalizedDynamicRefreshMs;
        }
    });

    return null;
}
