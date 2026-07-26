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
import {
    normalizeSceneFramesPerSecond,
    resolveSceneFramesPerSecond,
    resolveSceneFrameTick,
    resolveSceneVisibility,
} from './sceneFrameScheduler';

export const sceneFrameRates = {
    ambient: 30,
    interactive: 60,
} as const;

type SceneTimeContextValue = {
    acquireContinuousRender: (framesPerSecond?: number) => () => void;
    subscribeSceneResume: (listener: () => void) => () => void;
    timeUniform: IUniform<number>;
};

const SceneTimeContext = createContext<SceneTimeContextValue | null>(null);

export function SceneTimeProvider({
    baseFramesPerSecond = sceneFrameRates.ambient,
    children,
    fixedTimeSeconds,
    suspendWhenOffscreen = true,
}: PropsWithChildren<{
    baseFramesPerSecond?: number;
    fixedTimeSeconds?: number;
    suspendWhenOffscreen?: boolean;
}>) {
    const fixedTime = Number.isFinite(fixedTimeSeconds)
        ? Math.max(0, fixedTimeSeconds ?? 0)
        : undefined;
    const timeUniform = useMemo<IUniform<number>>(
        () => ({ value: fixedTime ?? 0 }),
        [fixedTime],
    );
    const invalidate = useThree((state) => state.invalidate);
    const clock = useThree((state) => state.clock);
    const gl = useThree((state) => state.gl);
    const animationFrameRef = useRef<number | null>(null);
    const baseFramesPerSecondRef = useRef(
        normalizeSceneFramesPerSecond(baseFramesPerSecond),
    );
    const canvasVisibleRef = useRef(true);
    const continuousRenderLeasesRef = useRef(new Map<symbol, number>());
    const disposedRef = useRef(false);
    const documentVisibleRef = useRef(
        typeof document !== 'undefined' ? !document.hidden : false,
    );
    const lastFrameTimestampRef = useRef<number | null>(null);
    const sceneResumeListenersRef = useRef(new Set<() => void>());
    const sceneVisibleRef = useRef(
        typeof document !== 'undefined' ? !document.hidden : false,
    );

    const stopContinuousRenderLoop = useCallback(() => {
        if (animationFrameRef.current === null) {
            return;
        }

        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }, []);

    const getTargetFramesPerSecond = useCallback(
        () =>
            resolveSceneFramesPerSecond(
                baseFramesPerSecondRef.current,
                continuousRenderLeasesRef.current.values(),
            ),
        [],
    );

    const subscribeSceneResume = useCallback((listener: () => void) => {
        sceneResumeListenersRef.current.add(listener);
        return () => {
            sceneResumeListenersRef.current.delete(listener);
        };
    }, []);

    const startContinuousRenderLoop = useCallback(() => {
        if (
            disposedRef.current ||
            !sceneVisibleRef.current ||
            animationFrameRef.current !== null ||
            getTargetFramesPerSecond() === 0
        ) {
            return;
        }

        const requestFrame = (timestamp: number) => {
            animationFrameRef.current = null;
            if (disposedRef.current || !sceneVisibleRef.current) {
                return;
            }

            const framesPerSecond = getTargetFramesPerSecond();
            if (framesPerSecond === 0) {
                return;
            }

            const frameTick = resolveSceneFrameTick({
                framesPerSecond,
                lastFrameTimestamp: lastFrameTimestampRef.current,
                timestamp,
            });
            lastFrameTimestampRef.current = frameTick.lastFrameTimestamp;
            if (frameTick.shouldRender) {
                invalidate();
            }

            animationFrameRef.current =
                window.requestAnimationFrame(requestFrame);
        };

        animationFrameRef.current = window.requestAnimationFrame(requestFrame);
    }, [getTargetFramesPerSecond, invalidate]);

    const syncSceneVisibility = useCallback(() => {
        const sceneVisible = resolveSceneVisibility({
            canvasVisible: canvasVisibleRef.current,
            documentVisible: documentVisibleRef.current,
            suspendWhenOffscreen,
        });
        if (sceneVisibleRef.current === sceneVisible) {
            return;
        }

        sceneVisibleRef.current = sceneVisible;
        lastFrameTimestampRef.current = null;
        if (sceneVisible) {
            clock.getDelta();
            for (const listener of sceneResumeListenersRef.current) {
                listener();
            }
            invalidate();
            startContinuousRenderLoop();
            return;
        }

        stopContinuousRenderLoop();
    }, [
        clock,
        invalidate,
        startContinuousRenderLoop,
        stopContinuousRenderLoop,
        suspendWhenOffscreen,
    ]);

    const acquireContinuousRender = useCallback(
        (framesPerSecond: number = sceneFrameRates.ambient) => {
            const normalizedFramesPerSecond =
                normalizeSceneFramesPerSecond(framesPerSecond);
            if (normalizedFramesPerSecond === 0) {
                return () => undefined;
            }

            const previousFramesPerSecond = getTargetFramesPerSecond();
            const lease = Symbol('scene-render-lease');
            continuousRenderLeasesRef.current.set(
                lease,
                normalizedFramesPerSecond,
            );
            const nextFramesPerSecond = getTargetFramesPerSecond();
            if (nextFramesPerSecond > previousFramesPerSecond) {
                lastFrameTimestampRef.current = null;
            }
            if (sceneVisibleRef.current) {
                invalidate();
                startContinuousRenderLoop();
            }

            let released = false;
            return () => {
                if (released) {
                    return;
                }

                released = true;
                continuousRenderLeasesRef.current.delete(lease);
                if (disposedRef.current) {
                    return;
                }

                if (getTargetFramesPerSecond() === 0) {
                    stopContinuousRenderLoop();
                }
            };
        },
        [
            getTargetFramesPerSecond,
            invalidate,
            startContinuousRenderLoop,
            stopContinuousRenderLoop,
        ],
    );

    useEffect(() => {
        disposedRef.current = false;
        return () => {
            disposedRef.current = true;
            stopContinuousRenderLoop();
            continuousRenderLeasesRef.current.clear();
            sceneResumeListenersRef.current.clear();
        };
    }, [stopContinuousRenderLoop]);

    useEffect(() => {
        const previousFramesPerSecond = getTargetFramesPerSecond();
        baseFramesPerSecondRef.current =
            normalizeSceneFramesPerSecond(baseFramesPerSecond);
        const nextFramesPerSecond = getTargetFramesPerSecond();
        if (nextFramesPerSecond > previousFramesPerSecond) {
            lastFrameTimestampRef.current = null;
        }

        if (nextFramesPerSecond === 0) {
            stopContinuousRenderLoop();
            return;
        }

        startContinuousRenderLoop();
    }, [
        baseFramesPerSecond,
        getTargetFramesPerSecond,
        startContinuousRenderLoop,
        stopContinuousRenderLoop,
    ]);

    useEffect(() => {
        const handleDocumentVisibility = () => {
            documentVisibleRef.current = !document.hidden;
            syncSceneVisibility();
        };
        const handlePageHide = () => {
            documentVisibleRef.current = false;
            syncSceneVisibility();
        };
        const handlePageShow = () => {
            documentVisibleRef.current = !document.hidden;
            syncSceneVisibility();
        };

        documentVisibleRef.current = !document.hidden;
        document.addEventListener('visibilitychange', handleDocumentVisibility);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('pageshow', handlePageShow);

        canvasVisibleRef.current = true;
        const observer =
            !suspendWhenOffscreen || typeof IntersectionObserver === 'undefined'
                ? null
                : new IntersectionObserver(([entry]) => {
                      canvasVisibleRef.current = Boolean(
                          entry?.isIntersecting &&
                              entry.intersectionRect.width > 0 &&
                              entry.intersectionRect.height > 0,
                      );
                      syncSceneVisibility();
                  });
        observer?.observe(gl.domElement);
        syncSceneVisibility();

        return () => {
            observer?.disconnect();
            document.removeEventListener(
                'visibilitychange',
                handleDocumentVisibility,
            );
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, [gl.domElement, suspendWhenOffscreen, syncSceneVisibility]);

    useFrame(({ clock }) => {
        timeUniform.value = fixedTime ?? clock.elapsedTime;
    });

    const contextValue = useMemo(
        () => ({
            acquireContinuousRender,
            subscribeSceneResume,
            timeUniform,
        }),
        [acquireContinuousRender, subscribeSceneResume, timeUniform],
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

export function useSceneTimeInvalidation(
    enabled = true,
    framesPerSecond: number = sceneFrameRates.ambient,
) {
    const sceneTime = useContext(SceneTimeContext);
    if (!sceneTime) {
        throw new Error('Missing SceneTimeProvider in the scene tree');
    }

    useEffect(() => {
        if (!enabled) {
            return;
        }

        return sceneTime.acquireContinuousRender(framesPerSecond);
    }, [enabled, framesPerSecond, sceneTime]);
}

export function useSceneResume(listener: () => void) {
    const sceneTime = useContext(SceneTimeContext);
    if (!sceneTime) {
        throw new Error('Missing SceneTimeProvider in the scene tree');
    }

    useEffect(
        () => sceneTime.subscribeSceneResume(listener),
        [listener, sceneTime],
    );
}
