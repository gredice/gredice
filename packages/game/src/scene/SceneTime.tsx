'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useEffect,
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

export function useSceneTimeInvalidation(enabled = true) {
    const invalidate = useThree((state) => state.invalidate);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let animationFrame = 0;

        const requestFrame = () => {
            invalidate();
            animationFrame = window.requestAnimationFrame(requestFrame);
        };

        animationFrame = window.requestAnimationFrame(requestFrame);

        return () => {
            window.cancelAnimationFrame(animationFrame);
        };
    }, [enabled, invalidate]);
}
