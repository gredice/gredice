'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { updateGameProfileMetadata } from './gameProfileMetadata';

const shadowSettleMs = 900;

export function ShadowMapController({
    enabled,
    invalidationKey,
}: {
    enabled: boolean;
    invalidationKey: string;
}) {
    const gl = useThree((state) => state.gl);
    const invalidationCountRef = useRef(0);
    const settleUntilRef = useRef(0);

    useLayoutEffect(() => {
        const previousAutoUpdate = gl.shadowMap.autoUpdate;

        gl.shadowMap.autoUpdate = !enabled;
        updateGameProfileMetadata({
            shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
            shadowMapInvalidationCount: invalidationCountRef.current,
        });

        return () => {
            gl.shadowMap.autoUpdate = previousAutoUpdate;
            gl.shadowMap.needsUpdate = true;
        };
    }, [enabled, gl]);

    useLayoutEffect(() => {
        void invalidationKey;

        if (!enabled) {
            updateGameProfileMetadata({
                shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
                shadowMapInvalidationCount: invalidationCountRef.current,
            });
            return;
        }

        gl.shadowMap.needsUpdate = true;
        settleUntilRef.current = performance.now() + shadowSettleMs;
        invalidationCountRef.current += 1;
        updateGameProfileMetadata({
            shadowMapAutoUpdate: gl.shadowMap.autoUpdate,
            shadowMapInvalidationCount: invalidationCountRef.current,
        });
    }, [enabled, gl, invalidationKey]);

    useFrame(() => {
        if (!enabled || performance.now() > settleUntilRef.current) {
            return;
        }

        gl.shadowMap.needsUpdate = true;
    });

    return null;
}
