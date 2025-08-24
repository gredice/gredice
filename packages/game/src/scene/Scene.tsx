'use client';

import { Canvas, type Vector3 as FiberVector3 } from '@react-three/fiber';
import type { HTMLAttributes, PropsWithChildren } from 'react';
import { PCFSoftShadowMap } from 'three';

export type SceneProps = HTMLAttributes<HTMLDivElement> &
    PropsWithChildren<{
        position: FiberVector3;
        zoom: number;
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
                near: 0.01,
            }}
            {...rest}
        >
            {children}
        </Canvas>
    );
}
