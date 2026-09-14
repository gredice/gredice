'use client';

import { useFrame, useStore, useThree } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
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
import { SceneSpringAnimationContext } from './SceneSpringContext';
import {
    createScenePostRenderDispatcher,
    type ScenePostRenderListener,
} from './scenePostRenderDispatcher';
import { getSceneRootRuntime } from './sceneRootRuntime';
import { registerGameSceneRuntimeActivity } from './sceneRuntimeActivity';
import { useSceneAfterFrame } from './useSceneAfterFrame';

export const sceneFrameRates = {
    ambient: 30,
    interactive: 60,
} as const;

const sceneTimeFramePriority = -1_000;

type SceneTimeContextValue = {
    acquireContinuousRender: (
        owner: string,
        framesPerSecond?: number,
    ) => () => void;
    acquireFixedStepWork: (
        owner: string,
        options: GameRuntimeFixedStepLeaseOptions,
    ) => () => void;
    continuousRenderLeasesEnabled: boolean;
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
    getRuntimeVisible: () => boolean;
    subscribeRuntimeVisibility: (
        listener: (visible: boolean) => void,
    ) => () => void;
    subscribeSceneAfterRender: (
        listener: ScenePostRenderListener,
    ) => () => void;
    subscribeSceneFrameReceipt: (
        listener: ScenePostRenderListener,
    ) => () => void;
    subscribeSceneResume: (listener: () => void) => () => void;
    flushScenePostRender: (timestampMs: number) => boolean;
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
    animateSprings = true,
    baseFramesPerSecond = 0,
    children,
    continuousRenderLeasesEnabled = true,
    fixedTimeSeconds,
    manualFrameloop = false,
    runtimeFrameLoop,
    suspendWhenOffscreen = true,
}: PropsWithChildren<{
    ambientFramesPerSecond?: number;
    animateSprings?: boolean;
    baseFramesPerSecond?: number;
    continuousRenderLeasesEnabled?: boolean;
    fixedTimeSeconds?: number;
    manualFrameloop?: boolean;
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
    const rootStore = useStore();
    const rootRuntime = getSceneRootRuntime(rootStore);
    const gl = useThree((state) => state.gl);
    const visibilityReadyRef = useRef(false);
    const frameStartRef = useRef<number | null>(null);
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
                invalidate: rootRuntime.requestFrame,
                now: () => globalThis.performance.now(),
                requestFrame: (callback) =>
                    window.requestAnimationFrame(callback),
                setTimeout: (callback, delayMs) =>
                    window.setTimeout(callback, delayMs),
            }),
    );
    const [postRenderDispatcher] = useState(() =>
        createScenePostRenderDispatcher({
            recordFrameReceipt: (timestampMs) => {
                if (!visibilityReadyRef.current) {
                    return false;
                }
                scheduler.recordFrameCallback(timestampMs);
                return true;
            },
        }),
    );
    const lifecycleGenerationRef = useRef(0);
    useLayoutEffect(() => {
        const disconnect = rootRuntime.connect((frames) => {
            if (!manualFrameloop) {
                scheduler.requestCoalescedRender('r3f-root-update', frames);
            }
        });
        const unsubscribe = scheduler.subscribeVisibility(
            rootRuntime.setVisible,
        );
        return () => {
            unsubscribe();
            rootRuntime.setVisible(false);
            disconnect();
        };
    }, [manualFrameloop, rootRuntime, scheduler]);

    useSceneAfterFrame(
        useCallback(() => {
            postRenderDispatcher.flushRenderedFrame(performance.now());
        }, [postRenderDispatcher]),
        !manualFrameloop,
    );

    useEffect(() => {
        scheduler.setBaseFramesPerSecond(baseFramesPerSecond);
        scheduler.setAmbientFramesPerSecond(resolvedAmbientFramesPerSecond);
    }, [baseFramesPerSecond, resolvedAmbientFramesPerSecond, scheduler]);

    useEffect(() => {
        if (!runtimeFrameLoop) {
            return;
        }

        return bindRuntimeFrameLoopProfileTelemetry(
            runtimeFrameLoop,
            () => ({
                ...scheduler.getSnapshot(),
                sceneTimeSeconds: timeUniform.value,
            }),
            undefined,
            () => scheduler.getFrequentProfileSnapshot(),
        );
    }, [runtimeFrameLoop, scheduler, timeUniform]);

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

    useEffect(() => {
        const registration = registerGameSceneRuntimeActivity(
            scheduler.getEffectiveVisibility(),
        );
        const unsubscribe = scheduler.subscribeVisibility(
            registration.setActive,
        );
        return () => {
            unsubscribe();
            registration.unregister();
        };
    }, [scheduler]);

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
        frameStartRef.current = gl.info.render.frame;
        timeUniform.value = fixedTime ?? sceneClock.elapsedTime;
        postRenderDispatcher.markRenderedFrame();
    }, sceneTimeFramePriority);

    const contextValue = useMemo<SceneTimeContextValue>(
        () => ({
            acquireContinuousRender: (owner, framesPerSecond) =>
                scheduler.acquireSharedRenderLease(owner, framesPerSecond),
            acquireFixedStepWork: (owner, options) =>
                scheduler.acquireFixedStepLease(owner, options),
            continuousRenderLeasesEnabled,
            fixedTimeSeconds: fixedTime,
            flushScenePostRender: (timestampMs) => {
                if (
                    frameStartRef.current === null ||
                    gl.info.render.frame <= frameStartRef.current ||
                    !postRenderDispatcher.hasRenderedFramePending()
                ) {
                    return false;
                }
                rootRuntime.flushAfterFrame();
                // A nonmanual root may have delivered its receipt via the
                // root callback above. Manual captures deliver it here.
                if (postRenderDispatcher.hasRenderedFramePending()) {
                    postRenderDispatcher.flushRenderedFrame(timestampMs);
                }
                return true;
            },
            getRuntimeVisible: () => scheduler.getEffectiveVisibility(),
            requestRender: (reason, frames) =>
                scheduler.requestRender(reason, frames),
            scheduleDeadline: (owner, absoluteTimeMs, callback) =>
                scheduler.scheduleDeadline(owner, absoluteTimeMs, callback),
            scheduleDeadlineAfter: (owner, delayMs, callback) =>
                scheduler.scheduleDeadlineAfter(owner, delayMs, callback),
            subscribeSceneResume: (listener) =>
                scheduler.subscribeResume(listener),
            subscribeSceneAfterRender:
                postRenderDispatcher.subscribeAfterRender,
            subscribeSceneFrameReceipt:
                postRenderDispatcher.subscribeFrameReceipt,
            subscribeRuntimeVisibility: (listener) =>
                scheduler.subscribeVisibility(listener),
            timeUniform,
        }),
        [
            continuousRenderLeasesEnabled,
            fixedTime,
            gl,
            postRenderDispatcher,
            rootRuntime,
            scheduler,
            timeUniform,
        ],
    );

    return (
        <SceneTimeContext.Provider value={contextValue}>
            <SceneSpringAnimationContext.Provider
                value={animateSprings && !manualFrameloop}
            >
                {children}
            </SceneSpringAnimationContext.Provider>
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

export function useSceneRuntimeVisible() {
    const sceneTime = useSceneTimeContext();
    return useSyncExternalStore(
        sceneTime.subscribeRuntimeVisibility,
        sceneTime.getRuntimeVisible,
        () => false,
    );
}

export function useSceneTimeInvalidation(
    owner: string,
    enabled = true,
    framesPerSecond?: number,
) {
    const sceneTime = useSceneTimeContext();

    useEffect(() => {
        if (!enabled || !sceneTime.continuousRenderLeasesEnabled) {
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
    const sceneTime = useContext(SceneTimeContext);
    const invalidate = useThree((state) => state.invalidate);
    return useCallback(
        (reason: string, frames?: number) => {
            if (sceneTime) return sceneTime.requestRender(reason, frames);
            invalidate(frames);
            return true;
        },
        [invalidate, sceneTime],
    );
}

export function useScenePostRenderFlush() {
    return useSceneTimeContext().flushScenePostRender;
}

export function useSceneAfterRenderSubscription() {
    return useSceneTimeContext().subscribeSceneAfterRender;
}

export function useSceneFrameReceiptSubscription() {
    return useSceneTimeContext().subscribeSceneFrameReceipt;
}

export function useSceneResume(listener: () => void) {
    const sceneTime = useContext(SceneTimeContext);

    useEffect(
        () => sceneTime?.subscribeSceneResume(listener),
        [listener, sceneTime],
    );
}
