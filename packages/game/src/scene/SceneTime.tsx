'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import type { IUniform } from 'three';

type SceneTimeContextValue = {
    acquireContinuousRender: () => () => void;
    timeUniform: IUniform<number>;
};

const SceneTimeContext = createContext<SceneTimeContextValue | null>(null);

export function SceneTimeProvider({
    children,
    fixedTimeSeconds,
}: PropsWithChildren<{ fixedTimeSeconds?: number }>) {
    const fixedTime = Number.isFinite(fixedTimeSeconds)
        ? Math.max(0, fixedTimeSeconds ?? 0)
        : undefined;
    const timeUniform = useMemo<IUniform<number>>(
        () => ({ value: fixedTime ?? 0 }),
        [fixedTime],
    );
    const invalidate = useThree((state) => state.invalidate);
    const setFrameloop = useThree((state) => state.setFrameloop);
    const frameloop = useThree((state) => state.frameloop);
    const animationFrameRef = useRef<number | null>(null);
    const continuousRenderLeaseCountRef = useRef(0);
    const frameloopRef = useRef(frameloop);
    const restoreFrameloopRef = useRef<typeof frameloop | null>(null);
    const startTimestampRef = useRef<number | null>(null);

    useEffect(() => {
        frameloopRef.current = frameloop;
    }, [frameloop]);

    const stopContinuousRenderLoop = useCallback(() => {
        if (animationFrameRef.current === null) {
            return;
        }

        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }, []);

    const startContinuousRenderLoop = useCallback(() => {
        if (animationFrameRef.current !== null) {
            return;
        }

        const requestFrame = (timestamp: number) => {
            startTimestampRef.current ??= timestamp;
            timeUniform.value =
                fixedTime ?? (timestamp - startTimestampRef.current) / 1000;
            invalidate();
            animationFrameRef.current =
                window.requestAnimationFrame(requestFrame);
        };

        animationFrameRef.current = window.requestAnimationFrame(requestFrame);
    }, [fixedTime, invalidate, timeUniform]);

    const acquireContinuousRender = useCallback(() => {
        continuousRenderLeaseCountRef.current += 1;

        if (continuousRenderLeaseCountRef.current === 1) {
            restoreFrameloopRef.current = frameloopRef.current;
            if (frameloopRef.current !== 'always') {
                setFrameloop('always');
            }
            startContinuousRenderLoop();
            invalidate();
        }

        let released = false;
        return () => {
            if (released) {
                return;
            }

            released = true;
            continuousRenderLeaseCountRef.current = Math.max(
                0,
                continuousRenderLeaseCountRef.current - 1,
            );

            if (continuousRenderLeaseCountRef.current > 0) {
                return;
            }

            stopContinuousRenderLoop();
            const restoreFrameloop = restoreFrameloopRef.current;
            restoreFrameloopRef.current = null;
            if (restoreFrameloop && restoreFrameloop !== frameloopRef.current) {
                setFrameloop(restoreFrameloop);
            }
            invalidate();
        };
    }, [
        invalidate,
        setFrameloop,
        startContinuousRenderLoop,
        stopContinuousRenderLoop,
    ]);

    useEffect(() => {
        return () => {
            stopContinuousRenderLoop();
        };
    }, [stopContinuousRenderLoop]);

    useFrame(({ clock }) => {
        startTimestampRef.current ??=
            performance.now() - clock.elapsedTime * 1000;
        timeUniform.value = fixedTime ?? clock.elapsedTime;
    });

    const contextValue = useMemo(
        () => ({
            acquireContinuousRender,
            timeUniform,
        }),
        [acquireContinuousRender, timeUniform],
    );

    return (
        <SceneTimeContext.Provider value={contextValue}>
            {children}
        </SceneTimeContext.Provider>
    );
}

export function useSceneTimeUniform() {
    const sceneTime = useContext(SceneTimeContext);
    if (!sceneTime) {
        throw new Error('Missing SceneTimeProvider in the scene tree');
    }

    return sceneTime.timeUniform;
}

export function useSceneTimeInvalidation(enabled = true) {
    const sceneTime = useContext(SceneTimeContext);
    if (!sceneTime) {
        throw new Error('Missing SceneTimeProvider in the scene tree');
    }

    useEffect(() => {
        if (!enabled) {
            return;
        }

        return sceneTime.acquireContinuousRender();
    }, [enabled, sceneTime]);
}
