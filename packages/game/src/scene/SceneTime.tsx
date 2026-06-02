'use client';

import { useFrame } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useMemo,
} from 'react';
import type { IUniform } from 'three';

const SceneTimeContext = createContext<IUniform<number> | null>(null);

export function SceneTimeProvider({ children }: PropsWithChildren) {
    const timeUniform = useMemo<IUniform<number>>(() => ({ value: 0 }), []);

    useFrame(({ clock }) => {
        timeUniform.value = clock.elapsedTime;
    });

    return (
        <SceneTimeContext.Provider value={timeUniform}>
            {children}
        </SceneTimeContext.Provider>
    );
}

export function useSceneTimeUniform() {
    const timeUniform = useContext(SceneTimeContext);
    if (!timeUniform) {
        throw new Error('Missing SceneTimeProvider in the scene tree');
    }

    return timeUniform;
}
