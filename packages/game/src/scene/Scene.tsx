'use client';

import { PCFSoftShadowMap } from 'three';
import { Canvas, Vector3 as FiberVector3 } from '@react-three/fiber';
import { HTMLAttributes, PropsWithChildren, useEffect } from 'react';
import { useGameState } from '../useGameState';
import { useGLTF } from '@react-three/drei';
import { models } from '../data/models';

export type SceneProps = HTMLAttributes<HTMLDivElement> & PropsWithChildren<{
    appBaseUrl?: string,
    freezeTime?: Date | null,
    position: FiberVector3,
    zoom: number,
}>;

export function Scene({ children, appBaseUrl, freezeTime, position, zoom, ...rest }: SceneProps) {
    // Set app base URL
    const setInitial = useGameState((state) => state.setInitial);
    useEffect(() => {
        setInitial(appBaseUrl ?? '', freezeTime);

        useGLTF.preload(appBaseUrl + models.GameAssets.url);
    }, [appBaseUrl]);

    return (
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
            {children}
        </Canvas>
    )
}
