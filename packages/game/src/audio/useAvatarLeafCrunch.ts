import { useEffect, useMemo } from 'react';
import {
    useSceneFixedTimeSeconds,
    useSceneRuntimeVisible,
} from '../scene/SceneTime';
import { useGameState, useGameStateStore } from '../useGameState';
import { useLeafStepCoverage } from './LeafStepCoverageProvider';
import { createLeafStepCadence, type LeafStepSample } from './leafStepState';

/** Owned by the local avatar, with no extra frame subscription or render lease. */
export function useAvatarLeafCrunch(seed: string) {
    const store = useGameStateStore();
    const coverage = useLeafStepCoverage();
    const fixedTime = useSceneFixedTimeSeconds();
    const visible = useSceneRuntimeVisible();
    const disabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const controller = useMemo(() => {
        const cadence = createLeafStepCadence(seed);
        const audio = store.getState().audio;
        let pending: AbortController | undefined;
        let lastSample: LeafStepSample | undefined;
        const audible = () => {
            const state = audio.getState();
            return (
                !state.isSuspended &&
                !state.isBackgrounded &&
                !state.master.isMuted &&
                !state.ambient.isMuted &&
                state.master.volume > 0 &&
                state.ambient.volume > 0
            );
        };
        const reset = () => {
            cadence.reset();
            pending?.abort();
            pending = undefined;
            lastSample = undefined;
        };
        return {
            reset,
            subscribe: () =>
                audio.subscribe(() => {
                    if (!audible()) reset();
                }),
            update(sample: LeafStepSample) {
                const state = store.getState();
                if (
                    !visible ||
                    fixedTime !== undefined ||
                    disabled ||
                    !audible() ||
                    state.activeDragPreview ||
                    state.pickupBlock ||
                    !sample.grounded
                ) {
                    reset();
                    return;
                }
                if (
                    pending &&
                    lastSample &&
                    (sample.distance <= lastSample.distance ||
                        sample.time - lastSample.time > 0.2 ||
                        Math.hypot(
                            sample.x - lastSample.x,
                            sample.z - lastSample.z,
                        ) > 1 ||
                        !coverage?.hasLeaves(sample))
                ) {
                    pending?.abort();
                    pending = undefined;
                }
                lastSample = sample;
                const step = cadence.update(sample);
                if (!step) return;
                pending?.abort();
                pending = undefined;
                if (!coverage?.hasLeaves(sample)) return;
                pending = new AbortController();
                void audio.playOneShot(
                    'ambient',
                    `${state.appBaseUrl}/assets/sounds/autumn-leaf-step-v1-${step.variant + 1}.wav`,
                    {
                        volume:
                            step.volume *
                            (1 -
                                Math.min(
                                    1,
                                    Math.max(0, state.rainSurfaceIntensity),
                                ) *
                                    0.65),
                        queueWhenLocked: false,
                        signal: pending.signal,
                        maxDelayMs: 100,
                        silentFailure: true,
                    },
                );
            },
        };
    }, [store, seed, coverage, visible, fixedTime, disabled]);
    useEffect(() => {
        const unsubscribe = controller.subscribe();
        return () => {
            unsubscribe();
            controller.reset();
        };
    }, [controller]);
    return controller;
}
