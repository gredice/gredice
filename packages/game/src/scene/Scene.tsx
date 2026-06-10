'use client';

import {
    Canvas,
    type Vector3 as FiberVector3,
    useFrame,
    useThree,
} from '@react-three/fiber';
import {
    type HTMLAttributes,
    type PropsWithChildren,
    useEffect,
    useRef,
} from 'react';
import { PCFShadowMap } from 'three';
import {
    HoverOutlineEffect,
    HoverOutlineProvider,
} from '../entities/helpers/HoverOutline';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import {
    type GameQualityProfile,
    resolveGameQualityProfile,
} from './gameQuality';
import { SceneTimeProvider } from './SceneTime';

export type SceneProps = HTMLAttributes<HTMLDivElement> &
    PropsWithChildren<{
        debugStats?: boolean;
        position: FiberVector3;
        quality?: GameQualityProfile;
        zoom: number;
    }>;

const rendererStatsUpdateMs = 500;

function RendererStatsReporter() {
    const lastUpdateRef = useRef(0);

    useFrame(({ gl }) => {
        const now = performance.now();
        if (now - lastUpdateRef.current < rendererStatsUpdateMs) {
            return;
        }

        lastUpdateRef.current = now;
        updateGameProfileMetadata({
            rendererGeometries: gl.info.memory.geometries,
            rendererLines: gl.info.render.lines,
            rendererPoints: gl.info.render.points,
            rendererRenderCalls: gl.info.render.calls,
            rendererShaders: gl.info.programs?.length,
            rendererTextures: gl.info.memory.textures,
            rendererTriangles: gl.info.render.triangles,
        });
    });

    return null;
}

function SceneDebugName() {
    const scene = useThree((state) => state.scene);

    useEffect(() => {
        scene.name = 'GrediceGameScene';
    }, [scene]);

    return null;
}

export function Scene({
    children,
    debugStats,
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
            <SceneTimeProvider>
                <HoverOutlineProvider>
                    <SceneDebugName />
                    {debugStats && <RendererStatsReporter />}
                    {children}
                    <HoverOutlineEffect />
                </HoverOutlineProvider>
            </SceneTimeProvider>
        </Canvas>
    );
}
