'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    type AdaptiveHighQualityLevelProfile,
    type AdaptiveHighQualityLoadSource,
    type AdaptiveHighQualityState,
    adaptiveHighQualityLevels,
    createAdaptiveHighQualityState,
    getAdaptiveHighQualitySnapshot,
    resumeAdaptiveHighQualityState,
    updateAdaptiveHighQuality,
} from './adaptiveHighQuality';
import {
    adaptiveHighQualityProfileControlEventName,
    readAdaptiveHighQualityProfileControlCommand,
} from './adaptiveHighQualityProfileControl';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import {
    sceneFrameRates,
    useSceneResume,
    useSceneTimeInvalidation,
} from './SceneTime';

const governorSampleIntervalMs = 250;
const interactiveGpuBudgetMs = 1_000 / 60;
const idleGpuBudgetMs = 25;
const frameOnTimeRatio = 1.2;
const maximumPendingGpuQueries = 4;
const gpuQueryTimeoutMs = 2_000;
const gpuDisjointQuarantineMs = 2_000;
const governorLongFrameGapMs = 1_000;

type PendingGpuQuery = {
    query: WebGLQuery;
    startedAtMs: number;
};

type DisjointTimerQueryWebGl2Extension = {
    GPU_DISJOINT_EXT: number;
    TIME_ELAPSED_EXT: number;
};

type GpuTimerState = {
    active: WebGLQuery | null;
    context: WebGL2RenderingContext | null;
    contextLost: boolean;
    disjointCount: number;
    extension: DisjointTimerQueryWebGl2Extension | null;
    pending: PendingGpuQuery[];
    quarantinedUntilMs: number;
    samplesMs: number[];
    supported: boolean | null;
};

type FrameWindow = {
    elapsedMs: number[];
    onTimeCount: number;
};

function createGpuTimerState(): GpuTimerState {
    return {
        active: null,
        context: null,
        contextLost: false,
        disjointCount: 0,
        extension: null,
        pending: [],
        quarantinedUntilMs: 0,
        samplesMs: [],
        supported: null,
    };
}

function createFrameWindow(): FrameWindow {
    return {
        elapsedMs: [],
        onTimeCount: 0,
    };
}

function isWebGl2Context(
    context: WebGLRenderingContext | WebGL2RenderingContext,
): context is WebGL2RenderingContext {
    return (
        typeof WebGL2RenderingContext !== 'undefined' &&
        context instanceof WebGL2RenderingContext
    );
}

function hasExternalGpuTimer() {
    return (
        typeof window !== 'undefined' &&
        Reflect.get(window, '__gameProfileGpuTimer') !== undefined
    );
}

function getDevicePixelRatio() {
    if (typeof window === 'undefined') {
        return 1;
    }

    const devicePixelRatio = window.devicePixelRatio;
    return Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
        ? devicePixelRatio
        : 1;
}

function average(values: number[]) {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((total, value) => total + value, 0) / values.length;
}

function resolveFrameWindowLoad(window: FrameWindow) {
    const sampleCount = window.elapsedMs.length;
    if (sampleCount === 0) {
        return null;
    }

    const onTimeRate = window.onTimeCount / sampleCount;
    if (onTimeRate >= 0.95) {
        return 0.7;
    }
    if (onTimeRate < 0.8) {
        return 1.2 + (0.8 - onTimeRate);
    }
    return 0.95;
}

function deletePendingQueries(timer: GpuTimerState) {
    const { context } = timer;
    if (context && !timer.contextLost) {
        for (const entry of timer.pending) {
            context.deleteQuery(entry.query);
        }
    }
    timer.pending = [];
}

function disposeGpuTimerQueries(timer: GpuTimerState) {
    const { context, extension } = timer;
    const activeQuery = timer.active;
    timer.active = null;

    if (context && !timer.contextLost && activeQuery) {
        if (extension) {
            const currentQuery = context.getQuery(
                extension.TIME_ELAPSED_EXT,
                context.CURRENT_QUERY,
            );
            if (currentQuery === activeQuery) {
                context.endQuery(extension.TIME_ELAPSED_EXT);
            }
        }
        context.deleteQuery(activeQuery);
    }

    deletePendingQueries(timer);
    timer.samplesMs = [];
}

function pollGpuQueries(timer: GpuTimerState, nowMs: number) {
    const { context, extension } = timer;
    if (!context || !extension || timer.contextLost) {
        return;
    }

    if (context.getParameter(extension.GPU_DISJOINT_EXT)) {
        deletePendingQueries(timer);
        timer.samplesMs = [];
        timer.disjointCount += 1;
        timer.quarantinedUntilMs = nowMs + gpuDisjointQuarantineMs;
        return;
    }

    const remaining: PendingGpuQuery[] = [];
    for (const entry of timer.pending) {
        if (
            context.getQueryParameter(
                entry.query,
                context.QUERY_RESULT_AVAILABLE,
            )
        ) {
            const elapsedNanoseconds = context.getQueryParameter(
                entry.query,
                context.QUERY_RESULT,
            );
            if (typeof elapsedNanoseconds === 'number') {
                timer.samplesMs.push(elapsedNanoseconds / 1_000_000);
            }
            context.deleteQuery(entry.query);
            continue;
        }

        if (nowMs - entry.startedAtMs >= gpuQueryTimeoutMs) {
            context.deleteQuery(entry.query);
            timer.supported = false;
            continue;
        }

        remaining.push(entry);
    }
    timer.pending = remaining;
}

function finishGpuQuery(
    timer: GpuTimerState,
    query: WebGLQuery,
    startedAtMs: number,
) {
    const { context, extension } = timer;
    if (timer.active !== query || !context || !extension || timer.contextLost) {
        return;
    }

    timer.active = null;
    const currentQuery = context.getQuery(
        extension.TIME_ELAPSED_EXT,
        context.CURRENT_QUERY,
    );
    if (currentQuery !== query) {
        context.deleteQuery(query);
        return;
    }

    context.endQuery(extension.TIME_ELAPSED_EXT);
    timer.pending.push({ query, startedAtMs });
}

function beginGpuQuery(
    timer: GpuTimerState,
    rendererContext: WebGLRenderingContext | WebGL2RenderingContext,
    nowMs: number,
) {
    if (
        timer.contextLost ||
        hasExternalGpuTimer() ||
        nowMs < timer.quarantinedUntilMs
    ) {
        return;
    }

    if (timer.context === null) {
        if (!isWebGl2Context(rendererContext)) {
            timer.supported = false;
            return;
        }

        timer.context = rendererContext;
        timer.extension = rendererContext.getExtension(
            'EXT_disjoint_timer_query_webgl2',
        );
        timer.supported = timer.extension !== null;
    }

    const { context, extension } = timer;
    if (
        !context ||
        !extension ||
        timer.supported !== true ||
        timer.active ||
        timer.pending.length >= maximumPendingGpuQueries
    ) {
        return;
    }

    pollGpuQueries(timer, nowMs);
    if (
        nowMs < timer.quarantinedUntilMs ||
        context.getQuery(extension.TIME_ELAPSED_EXT, context.CURRENT_QUERY) !==
            null
    ) {
        return;
    }

    const query = context.createQuery();
    if (!query) {
        timer.supported = false;
        return;
    }

    context.beginQuery(extension.TIME_ELAPSED_EXT, query);
    timer.active = query;
    queueMicrotask(() => finishGpuQuery(timer, query, nowMs));
}

export function AdaptiveHighQualityController({
    effectiveDprCeiling,
    enabled,
    interactionActive,
    onProfileChange,
    profileControlEnabled,
}: {
    effectiveDprCeiling: number;
    enabled: boolean;
    interactionActive: boolean;
    onProfileChange: (profile: AdaptiveHighQualityLevelProfile) => void;
    profileControlEnabled: boolean;
}) {
    const gl = useThree((state) => state.gl);
    const governorStateRef = useRef<AdaptiveHighQualityState>(
        createAdaptiveHighQualityState({ effectiveDprCeiling }),
    );
    const gpuTimerRef = useRef<GpuTimerState>(createGpuTimerState());
    const frameWindowRef = useRef<FrameWindow>(createFrameWindow());
    const interactionActiveRef = useRef(interactionActive);
    const [displayDpr, setDisplayDpr] = useState(getDevicePixelRatio);
    const currentProfileRef = useRef<AdaptiveHighQualityLevelProfile>(
        adaptiveHighQualityLevels.L0,
    );
    const lastFrameAtMsRef = useRef<number | null>(null);
    const lastGovernorSampleAtMsRef = useRef(0);
    const lastRawSampleAtMsRef = useRef(0);
    const rawSampleEwmaMsRef = useRef<number | null>(null);
    const reasonRef = useRef('full-quality');
    const onProfileChangeRef = useRef(onProfileChange);
    const profileControlActiveRef = useRef(false);
    const profileControlSampleCountRef = useRef(0);
    onProfileChangeRef.current = onProfileChange;
    interactionActiveRef.current = interactionActive;
    useSceneTimeInvalidation(
        'adaptive-high-interaction',
        enabled && interactionActive,
        sceneFrameRates.interactive,
    );

    const publishSnapshot = useCallback(
        ({ nowMs, rawSampleMs }: { nowMs: number; rawSampleMs: number }) => {
            const snapshot = getAdaptiveHighQualitySnapshot(
                governorStateRef.current,
                nowMs,
            );
            const timer = gpuTimerRef.current;

            updateGameProfileMetadata({
                adaptiveHighAmbientFps: snapshot.profile.ambientFramesPerSecond,
                adaptiveHighCloudUpdateMs: snapshot.profile.cloudShadowUpdateMs,
                adaptiveHighDeclineCount: snapshot.declineCount,
                adaptiveHighDprCap: snapshot.profile.dpr,
                adaptiveHighEnabled: enabled,
                adaptiveHighEwmaMs: rawSampleEwmaMsRef.current ?? rawSampleMs,
                adaptiveHighFactor: snapshot.profile.factor,
                adaptiveHighGpuTimerDisjointCount: timer.disjointCount,
                adaptiveHighGpuTimerPendingCount:
                    timer.pending.length + (timer.active ? 1 : 0),
                adaptiveHighGpuTimerSupported: timer.supported === true,
                adaptiveHighInteractionActive: interactionActiveRef.current,
                adaptiveHighLevel: Number.parseInt(snapshot.level.slice(1), 10),
                adaptiveHighLevelDwellMs: snapshot.currentLevelDwellMs,
                adaptiveHighLoad:
                    snapshot.normalizedLoadEwma ?? snapshot.normalizedLoad ?? 0,
                adaptiveHighOscillationCount: snapshot.oscillationCount,
                adaptiveHighProfileControlActive:
                    profileControlActiveRef.current,
                adaptiveHighProfileControlEnabled: profileControlEnabled,
                adaptiveHighProfileControlSampleCount:
                    profileControlSampleCountRef.current,
                adaptiveHighReason: reasonRef.current,
                adaptiveHighRecoveryCount: snapshot.recoveryCount,
                adaptiveHighSampleMs: rawSampleMs,
                adaptiveHighSampleSource: snapshot.source ?? 'frame',
                adaptiveHighTransitionCount: snapshot.transitionCount,
            });
        },
        [enabled, profileControlEnabled],
    );

    const processGovernorSample = useCallback(
        ({
            normalizedLoad,
            nowMs,
            rawSampleMs,
            source,
        }: {
            normalizedLoad: number;
            nowMs: number;
            rawSampleMs: number;
            source: AdaptiveHighQualityLoadSource;
        }) => {
            const previousRawSampleAtMs = lastRawSampleAtMsRef.current;
            const previousRawSampleEwmaMs = rawSampleEwmaMsRef.current;
            const elapsedMs =
                previousRawSampleAtMs === 0
                    ? governorSampleIntervalMs
                    : nowMs - previousRawSampleAtMs;
            const alpha = 1 - Math.exp(-elapsedMs / 1_000);
            rawSampleEwmaMsRef.current =
                previousRawSampleEwmaMs === null
                    ? rawSampleMs
                    : previousRawSampleEwmaMs +
                      alpha * (rawSampleMs - previousRawSampleEwmaMs);
            lastRawSampleAtMsRef.current = nowMs;

            const update = updateAdaptiveHighQuality(governorStateRef.current, {
                interactionActive: interactionActiveRef.current,
                normalizedLoad,
                nowMs,
                source,
            });
            governorStateRef.current = update.state;
            if (update.transition) {
                reasonRef.current = update.transition.reason;
                currentProfileRef.current = getAdaptiveHighQualitySnapshot(
                    update.state,
                    nowMs,
                ).profile;
                onProfileChangeRef.current(currentProfileRef.current);
            }
            publishSnapshot({ nowMs, rawSampleMs });
        },
        [publishSnapshot],
    );

    const resetSamplingAfterPause = useCallback(
        (nowMs: number, reason: 'sampling-gap' | 'scene-resume') => {
            governorStateRef.current = resumeAdaptiveHighQualityState(
                governorStateRef.current,
                nowMs,
            );
            disposeGpuTimerQueries(gpuTimerRef.current);
            frameWindowRef.current = createFrameWindow();
            lastFrameAtMsRef.current = null;
            lastGovernorSampleAtMsRef.current = nowMs;
            lastRawSampleAtMsRef.current = 0;
            rawSampleEwmaMsRef.current = null;
            reasonRef.current = reason;
        },
        [],
    );
    const handleSceneResume = useCallback(() => {
        resetSamplingAfterPause(performance.now(), 'scene-resume');
    }, [resetSamplingAfterPause]);
    useSceneResume(handleSceneResume);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let resolutionQuery: MediaQueryList | null = null;
        const handleDisplayDprChange = () => {
            setDisplayDpr(getDevicePixelRatio());
            subscribeToCurrentResolution();
        };
        const subscribeToCurrentResolution = () => {
            resolutionQuery?.removeEventListener(
                'change',
                handleDisplayDprChange,
            );
            if (typeof window.matchMedia !== 'function') {
                resolutionQuery = null;
                return;
            }
            resolutionQuery = window.matchMedia(
                `(resolution: ${getDevicePixelRatio()}dppx)`,
            );
            resolutionQuery.addEventListener('change', handleDisplayDprChange);
        };

        handleDisplayDprChange();
        window.addEventListener('resize', handleDisplayDprChange);
        window.addEventListener('orientationchange', handleDisplayDprChange);
        return () => {
            resolutionQuery?.removeEventListener(
                'change',
                handleDisplayDprChange,
            );
            window.removeEventListener('resize', handleDisplayDprChange);
            window.removeEventListener(
                'orientationchange',
                handleDisplayDprChange,
            );
        };
    }, [enabled]);

    useEffect(() => {
        const nowMs = performance.now();
        const currentDisplayDpr = enabled ? getDevicePixelRatio() : displayDpr;
        const effectiveCeiling = Math.min(
            effectiveDprCeiling,
            currentDisplayDpr,
        );
        governorStateRef.current = createAdaptiveHighQualityState({
            effectiveDprCeiling: effectiveCeiling,
            nowMs,
        });
        profileControlActiveRef.current = false;
        profileControlSampleCountRef.current = 0;
        disposeGpuTimerQueries(gpuTimerRef.current);
        gpuTimerRef.current = createGpuTimerState();
        frameWindowRef.current = createFrameWindow();
        lastFrameAtMsRef.current = null;
        lastGovernorSampleAtMsRef.current = nowMs;
        lastRawSampleAtMsRef.current = 0;
        rawSampleEwmaMsRef.current = null;
        reasonRef.current = enabled ? 'full-quality' : 'disabled';

        const snapshot = getAdaptiveHighQualitySnapshot(
            governorStateRef.current,
            nowMs,
        );
        currentProfileRef.current = snapshot.profile;
        onProfileChangeRef.current(snapshot.profile);
        publishSnapshot({ nowMs, rawSampleMs: 0 });
    }, [displayDpr, effectiveDprCeiling, enabled, publishSnapshot]);

    useEffect(() => {
        if (!enabled || !profileControlEnabled) {
            return;
        }

        const startProfileControl = (nowMs: number) => {
            const effectiveCeiling = Math.min(
                effectiveDprCeiling,
                getDevicePixelRatio(),
            );
            governorStateRef.current = createAdaptiveHighQualityState({
                effectiveDprCeiling: effectiveCeiling,
                nowMs,
            });
            disposeGpuTimerQueries(gpuTimerRef.current);
            gpuTimerRef.current = createGpuTimerState();
            frameWindowRef.current = createFrameWindow();
            lastFrameAtMsRef.current = null;
            lastGovernorSampleAtMsRef.current = nowMs;
            lastRawSampleAtMsRef.current = 0;
            rawSampleEwmaMsRef.current = null;
            profileControlActiveRef.current = true;
            profileControlSampleCountRef.current = 0;
            reasonRef.current = 'profile-control-start';

            const snapshot = getAdaptiveHighQualitySnapshot(
                governorStateRef.current,
                nowMs,
            );
            currentProfileRef.current = snapshot.profile;
            onProfileChangeRef.current(snapshot.profile);
            publishSnapshot({ nowMs, rawSampleMs: 0 });
        };
        const stopProfileControl = (nowMs: number) => {
            profileControlActiveRef.current = false;
            resetSamplingAfterPause(nowMs, 'scene-resume');
            reasonRef.current = 'profile-control-stop';
            publishSnapshot({ nowMs, rawSampleMs: 0 });
        };
        const handleProfileControlCommand = (event: Event) => {
            const command =
                event instanceof CustomEvent
                    ? readAdaptiveHighQualityProfileControlCommand(event.detail)
                    : null;
            if (!command) {
                return;
            }

            const nowMs = performance.now();
            if (command.action === 'start') {
                startProfileControl(nowMs);
                return;
            }
            if (command.action === 'stop') {
                if (profileControlActiveRef.current) {
                    stopProfileControl(nowMs);
                }
                return;
            }
            if (!profileControlActiveRef.current) {
                return;
            }

            profileControlSampleCountRef.current += 1;
            const sampleBudgetMs =
                command.source === 'gpu'
                    ? interactionActiveRef.current
                        ? interactiveGpuBudgetMs
                        : idleGpuBudgetMs
                    : 1_000 /
                      (interactionActiveRef.current
                          ? sceneFrameRates.interactive
                          : currentProfileRef.current.ambientFramesPerSecond);
            processGovernorSample({
                normalizedLoad: command.normalizedLoad,
                nowMs,
                rawSampleMs: command.normalizedLoad * sampleBudgetMs,
                source: command.source,
            });
        };

        window.addEventListener(
            adaptiveHighQualityProfileControlEventName,
            handleProfileControlCommand,
        );
        return () => {
            window.removeEventListener(
                adaptiveHighQualityProfileControlEventName,
                handleProfileControlCommand,
            );
            profileControlActiveRef.current = false;
        };
    }, [
        effectiveDprCeiling,
        enabled,
        processGovernorSample,
        profileControlEnabled,
        publishSnapshot,
        resetSamplingAfterPause,
    ]);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        if (!interactionActive) {
            if (profileControlActiveRef.current) {
                publishSnapshot({
                    nowMs: performance.now(),
                    rawSampleMs: rawSampleEwmaMsRef.current ?? 0,
                });
            }
            return;
        }

        processGovernorSample({
            normalizedLoad: governorStateRef.current.normalizedLoadEwma ?? 1,
            nowMs: performance.now(),
            rawSampleMs: rawSampleEwmaMsRef.current ?? 0,
            source: governorStateRef.current.source ?? 'frame',
        });
    }, [enabled, interactionActive, processGovernorSample, publishSnapshot]);

    useEffect(() => {
        const canvas = gl.domElement;
        const handleContextLost = () => {
            const timer = gpuTimerRef.current;
            timer.contextLost = true;
            timer.supported = false;
            disposeGpuTimerQueries(timer);
        };
        const handleContextRestored = () => {
            resetSamplingAfterPause(performance.now(), 'scene-resume');
            gpuTimerRef.current = createGpuTimerState();
        };
        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener(
                'webglcontextrestored',
                handleContextRestored,
            );
            disposeGpuTimerQueries(gpuTimerRef.current);
        };
    }, [gl.domElement, resetSamplingAfterPause]);

    useFrame(() => {
        if (!enabled) {
            return;
        }
        if (profileControlActiveRef.current) {
            return;
        }

        const nowMs = performance.now();
        const targetFrameMs = interactionActiveRef.current
            ? interactiveGpuBudgetMs
            : 1_000 / currentProfileRef.current.ambientFramesPerSecond;
        const lastFrameAtMs = lastFrameAtMsRef.current;
        if (lastFrameAtMs !== null) {
            const elapsedMs = nowMs - lastFrameAtMs;
            if (elapsedMs <= governorLongFrameGapMs) {
                frameWindowRef.current.elapsedMs.push(elapsedMs);
                if (elapsedMs <= targetFrameMs * frameOnTimeRatio) {
                    frameWindowRef.current.onTimeCount += 1;
                }
            } else {
                resetSamplingAfterPause(nowMs, 'sampling-gap');
            }
        }
        lastFrameAtMsRef.current = nowMs;

        const timer = gpuTimerRef.current;
        pollGpuQueries(timer, nowMs);
        beginGpuQuery(timer, gl.getContext(), nowMs);

        if (
            nowMs - lastGovernorSampleAtMsRef.current <
            governorSampleIntervalMs
        ) {
            return;
        }
        lastGovernorSampleAtMsRef.current = nowMs;

        if (
            timer.supported === true &&
            !hasExternalGpuTimer() &&
            timer.samplesMs.length > 0
        ) {
            const sampleMs = average(timer.samplesMs);
            timer.samplesMs = [];
            frameWindowRef.current = createFrameWindow();
            const budgetMs = interactionActiveRef.current
                ? interactiveGpuBudgetMs
                : idleGpuBudgetMs;
            processGovernorSample({
                normalizedLoad: sampleMs / budgetMs,
                nowMs,
                rawSampleMs: sampleMs,
                source: 'gpu',
            });
            return;
        }

        const frameLoad = resolveFrameWindowLoad(frameWindowRef.current);
        if (frameLoad === null) {
            return;
        }
        const frameSampleMs = average(frameWindowRef.current.elapsedMs);
        frameWindowRef.current = createFrameWindow();
        processGovernorSample({
            normalizedLoad: frameLoad,
            nowMs,
            rawSampleMs: frameSampleMs,
            source: 'frame',
        });
    });

    return null;
}
