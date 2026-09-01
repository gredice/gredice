'use client';

import { addAfterEffect, useFrame, useThree } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { IUniform, WebGLRenderer } from 'three';
import {
    type GameRuntimeDeadline,
    type GameRuntimeFixedStep,
    type GameRuntimeFixedStepLeaseOptions,
    GameRuntimeScheduler,
} from './GameRuntimeScheduler';
import type { RuntimeFrameLoopProfileTelemetry } from './gameProfileMetadata';
import { bindRuntimeFrameLoopProfileTelemetry } from './gameProfileMetadata';

export const sceneFrameRates = {
    ambient: 30,
    interactive: 60,
} as const;

type SceneTimeContextValue = {
    acquireContinuousRender: (
        owner: string,
        framesPerSecond?: number,
    ) => () => void;
    acquireFixedStepWork: (
        owner: string,
        options: GameRuntimeFixedStepLeaseOptions,
    ) => () => void;
    fixedTimeSeconds: number | undefined;
    requestRender: (reason: string, frames?: number) => boolean;
    scheduleDeadline: (
        owner: string,
        absoluteTimeMs: number,
        callback: (deadline: GameRuntimeDeadline) => void,
    ) => () => void;
    scheduleDeadlineAfter: (
        owner: string,
        delayMs: number,
        callback: (deadline: GameRuntimeDeadline) => void,
    ) => () => void;
    subscribeSceneResume: (listener: () => void) => () => void;
    timeUniform: IUniform<number>;
};

const SceneTimeContext = createContext<SceneTimeContextValue | null>(null);

function readRendererContextAvailable(gl: WebGLRenderer) {
    return !gl.getContext().isContextLost();
}

function readCanvasViewportVisible(canvas: HTMLCanvasElement) {
    const bounds = canvas.getBoundingClientRect();
    return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom > 0 &&
        bounds.right > 0 &&
        bounds.top < window.innerHeight &&
        bounds.left < window.innerWidth
    );
}

export function SceneTimeProvider({
    ambientFramesPerSecond,
    baseFramesPerSecond = sceneFrameRates.ambient,
    children,
    fixedTimeSeconds,
    runtimeFrameLoop,
    suspendWhenOffscreen = true,
}: PropsWithChildren<{
    ambientFramesPerSecond?: number;
    baseFramesPerSecond?: number;
    fixedTimeSeconds?: number;
    runtimeFrameLoop?: RuntimeFrameLoopProfileTelemetry;
    suspendWhenOffscreen?: boolean;
}>) {
    const resolvedAmbientFramesPerSecond =
        ambientFramesPerSecond ?? baseFramesPerSecond;
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
    const invalidateRef = useRef(invalidate);
    invalidateRef.current = invalidate;
    const [scheduler] = useState(
        () =>
            new GameRuntimeScheduler({
                ambientFramesPerSecond: resolvedAmbientFramesPerSecond,
                baseFramesPerSecond,
                cancelFrame: (handle) => {
                    if (typeof handle === 'number') {
                        window.cancelAnimationFrame(handle);
                    }
                },
                clearTimeout: (handle) => {
                    if (typeof handle === 'number') {
                        window.clearTimeout(handle);
                    }
                },
                initialVisibility: {
                    canvasVisible: false,
                    contextAvailable: false,
                    documentVisible: false,
                    requireCanvasVisible: suspendWhenOffscreen,
                },
                invalidate: () => invalidateRef.current(),
                now: () => globalThis.performance.now(),
                requestFrame: (callback) =>
                    window.requestAnimationFrame(callback),
                setTimeout: (callback, delayMs) =>
                    window.setTimeout(callback, delayMs),
            }),
    );
    const lifecycleGenerationRef = useRef(0);
    const renderedThisLoopRef = useRef(false);
    const visibilityReadyRef = useRef(false);

    useEffect(
        () =>
            addAfterEffect((timestamp) => {
                if (!renderedThisLoopRef.current) {
                    return;
                }
                renderedThisLoopRef.current = false;
                if (visibilityReadyRef.current) {
                    scheduler.recordFrameCallback(timestamp);
                }
            }),
        [scheduler],
    );

    useEffect(() => {
        scheduler.setBaseFramesPerSecond(baseFramesPerSecond);
        scheduler.setAmbientFramesPerSecond(resolvedAmbientFramesPerSecond);
    }, [baseFramesPerSecond, resolvedAmbientFramesPerSecond, scheduler]);

    useEffect(() => {
        if (!runtimeFrameLoop) {
            return;
        }

        return bindRuntimeFrameLoopProfileTelemetry(runtimeFrameLoop, () =>
            scheduler.getSnapshot(),
        );
    }, [runtimeFrameLoop, scheduler]);

    useEffect(() => {
        const generation = lifecycleGenerationRef.current + 1;
        lifecycleGenerationRef.current = generation;

        return () => {
            const disposalGeneration = lifecycleGenerationRef.current + 1;
            lifecycleGenerationRef.current = disposalGeneration;
            // React StrictMode immediately sets the effect up again. Deferring
            // disposal lets that setup retain the same scheduler while a real
            // unmount still cancels every pending callback before the next task.
            globalThis.queueMicrotask(() => {
                if (lifecycleGenerationRef.current === disposalGeneration) {
                    scheduler.dispose();
                }
            });
        };
    }, [scheduler]);

    useEffect(
        () => scheduler.subscribeActivation(() => clock.getDelta()),
        [clock, scheduler],
    );

    useEffect(() => {
        let active = true;
        visibilityReadyRef.current = false;
        const canvas = gl.domElement;
        const updateVisibility = (
            visibility: Parameters<typeof scheduler.setVisibility>[0],
        ) => {
            if (active) {
                scheduler.setVisibility(visibility);
            }
        };
        const handleDocumentVisibility = () => {
            updateVisibility({ documentVisible: !document.hidden });
        };
        const handlePageHide = () => {
            updateVisibility({ documentVisible: false });
        };
        const handlePageShow = () => {
            updateVisibility({ documentVisible: !document.hidden });
        };
        const handleContextLost = () => {
            updateVisibility({ contextAvailable: false });
        };
        const handleContextRestored = () => {
            updateVisibility({
                contextAvailable: readRendererContextAvailable(gl),
            });
        };
        const canObserveCanvas =
            suspendWhenOffscreen && typeof IntersectionObserver !== 'undefined';
        const observer = canObserveCanvas
            ? new IntersectionObserver(([entry]) => {
                  updateVisibility({
                      canvasVisible: Boolean(
                          entry?.isIntersecting &&
                              entry.intersectionRect.width > 0 &&
                              entry.intersectionRect.height > 0,
                      ),
                  });
              })
            : null;

        document.addEventListener('visibilitychange', handleDocumentVisibility);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('pageshow', handlePageShow);
        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        observer?.observe(canvas);
        updateVisibility({
            canvasVisible:
                !canObserveCanvas || readCanvasViewportVisible(canvas),
            contextAvailable: readRendererContextAvailable(gl),
            documentVisible: !document.hidden,
            requireCanvasVisible: suspendWhenOffscreen,
        });
        visibilityReadyRef.current = true;

        return () => {
            active = false;
            visibilityReadyRef.current = false;
            observer?.disconnect();
            document.removeEventListener(
                'visibilitychange',
                handleDocumentVisibility,
            );
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('pageshow', handlePageShow);
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener(
                'webglcontextrestored',
                handleContextRestored,
            );
        };
    }, [gl, scheduler, suspendWhenOffscreen]);

    useFrame(({ clock: sceneClock }) => {
        timeUniform.value = fixedTime ?? sceneClock.elapsedTime;
        renderedThisLoopRef.current = true;
    });

    const contextValue = useMemo<SceneTimeContextValue>(
        () => ({
            acquireContinuousRender: (owner, framesPerSecond) =>
                scheduler.acquireRenderLease(owner, framesPerSecond),
            acquireFixedStepWork: (owner, options) =>
                scheduler.acquireFixedStepLease(owner, options),
            fixedTimeSeconds: fixedTime,
            requestRender: (reason, frames) =>
                scheduler.requestRender(reason, frames),
            scheduleDeadline: (owner, absoluteTimeMs, callback) =>
                scheduler.scheduleDeadline(owner, absoluteTimeMs, callback),
            scheduleDeadlineAfter: (owner, delayMs, callback) =>
                scheduler.scheduleDeadlineAfter(owner, delayMs, callback),
            subscribeSceneResume: (listener) =>
                scheduler.subscribeResume(listener),
            timeUniform,
        }),
        [fixedTime, scheduler, timeUniform],
    );

    return (
        <SceneTimeContext.Provider value={contextValue}>
            {children}
        </SceneTimeContext.Provider>
    );
}

function useSceneTimeContext() {
    const sceneTime = useContext(SceneTimeContext);
    if (!sceneTime) {
        throw new Error('Missing SceneTimeProvider in the scene tree');
    }
    return sceneTime;
}

export function useSceneTimeUniform() {
    return useSceneTimeContext().timeUniform;
}

export function useSceneFixedTimeSeconds() {
    return useSceneTimeContext().fixedTimeSeconds;
}

export function useSceneTimeInvalidation(
    owner: string,
    enabled = true,
    framesPerSecond?: number,
) {
    const sceneTime = useSceneTimeContext();

    useEffect(() => {
        if (!enabled) {
            return;
        }

        return sceneTime.acquireContinuousRender(owner, framesPerSecond);
    }, [enabled, framesPerSecond, owner, sceneTime]);
}

export function useSceneFixedStepWork({
    callback,
    enabled = true,
    maxDeltaMs,
    owner,
    stepsPerSecond,
}: {
    callback: (step: GameRuntimeFixedStep) => void;
    enabled?: boolean;
    maxDeltaMs?: number;
    owner: string;
    stepsPerSecond: number;
}) {
    const sceneTime = useSceneTimeContext();
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        if (!enabled) {
            return;
        }

        return sceneTime.acquireFixedStepWork(owner, {
            callback: (step) => callbackRef.current(step),
            maxDeltaMs,
            stepsPerSecond,
        });
    }, [enabled, maxDeltaMs, owner, sceneTime, stepsPerSecond]);
}

export function useSceneDeadline({
    callback,
    deadlineMs,
    enabled = true,
    owner,
}: {
    callback: (deadline: GameRuntimeDeadline) => void;
    deadlineMs: number | null;
    enabled?: boolean;
    owner: string;
}) {
    const sceneTime = useSceneTimeContext();
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        if (!enabled || deadlineMs === null) {
            return;
        }

        return sceneTime.scheduleDeadline(owner, deadlineMs, (deadline) =>
            callbackRef.current(deadline),
        );
    }, [deadlineMs, enabled, owner, sceneTime]);
}

export function useSceneRenderRequest() {
    return useSceneTimeContext().requestRender;
}

export function useSceneResume(listener: () => void) {
    const sceneTime = useSceneTimeContext();

    useEffect(
        () => sceneTime.subscribeSceneResume(listener),
        [listener, sceneTime],
    );
}
