'use client';

import { Canvas, type Vector3 as FiberVector3 } from '@react-three/fiber';
import { type HTMLAttributes, type PropsWithChildren, useEffect } from 'react';
import { PCFShadowMap } from 'three';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import {
    type GameQualityProfile,
    resolveGameQualityProfile,
} from './gameQuality';

export type SceneProps = HTMLAttributes<HTMLDivElement> &
    PropsWithChildren<{
        position: FiberVector3;
        quality?: GameQualityProfile;
        zoom: number;
    }>;

export function Scene({
    children,
    position,
    quality,
    zoom,
    ...rest
}: SceneProps) {
    const qualityProfile = quality ?? resolveGameQualityProfile();

    useEffect(() => {
        updateGameProfileMetadata({
            dprCap: qualityProfile.dpr,
            groundDecorationDensity: qualityProfile.groundDecorationDensity,
            qualityTier: qualityProfile.tier,
            shadowMapSize: qualityProfile.shadowMapSize,
            shadowsEnabled: qualityProfile.shadows,
            snowOverlayMinCoverage: qualityProfile.snowOverlayMinCoverage,
        });
    }, [qualityProfile]);

    return (
        <Canvas
            orthographic
            dpr={[1, qualityProfile.dpr]}
            shadows={
                qualityProfile.shadows
                    ? {
                          type: PCFShadowMap,
                          enabled: true,
                      }
                    : false
            }
            camera={{
                position,
                zoom,
                far: 10000,
                near: 0.01,
            }}
            {...rest}
        >
            {children}
        </Canvas>
    );
}
