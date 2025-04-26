'use client';

import { PCFSoftShadowMap } from 'three';
import { Canvas, Vector3 as FiberVector3 } from '@react-three/fiber';
import { HTMLAttributes, PropsWithChildren } from 'react';

export type SceneProps = HTMLAttributes<HTMLDivElement> & PropsWithChildren<{
    position: FiberVector3,
    zoom: number,
}>;

export function Scene({ children, position, zoom, ...rest }: SceneProps) {
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
