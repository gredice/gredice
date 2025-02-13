'use client';

import { PCFSoftShadowMap } from 'three';
import { Canvas, Vector3 as FiberVector3, useThree } from '@react-three/fiber';
import { HTMLAttributes, PropsWithChildren, useEffect } from 'react';
import { SceneLoader } from './SceneLoader';
import { useGLTF } from '@react-three/drei';
import { models } from '../data/models';
import { useGameState } from '../useGameState';

export type SceneProps = HTMLAttributes<HTMLDivElement> & PropsWithChildren<{
    appBaseUrl?: string,
    freezeTime?: Date | null,
    position: FiberVector3,
    zoom: number,
}>;

function CameraSetter() {
    const { camera } = useThree();
    const setCamera = useGameState(state => state.setCamera);
    useEffect(() => {
        setCamera(camera);
    }, [camera, setCamera]);
    return null;
}

export function Scene({ children, appBaseUrl, freezeTime, position, zoom, ...rest }: SceneProps) {
    useGLTF.preload((appBaseUrl ?? '') + models.GameAssets.url);

    return (
        <SceneLoader appBaseUrl={appBaseUrl} freezeTime={freezeTime}>
            <Canvas
                orthographic
                shadows={{
                    type: PCFSoftShadowMap,
                    enabled: true,
                }}
                camera={{
                    position,
                    zoom,
                    far: 10000,
                    near: 0.01
                }}
                {...rest}>
                <CameraSetter />
                {children}
            </Canvas>
        </SceneLoader>
    )
}
