'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import {
    getGeneratedPlantProfileSessionId,
    recordGeneratedPlantProfileShaderPrewarm,
} from '../../scene/generatedPlantProfileMetrics';
import {
    GENERATED_PLANT_SHADER_PREWARM_COMPILE_TIMEOUT_MS,
    type GeneratedPlantShaderPrewarmCompletionStatus,
    type GeneratedPlantShaderPrewarmResult,
    requestGeneratedPlantShaderPrewarm,
    subscribeToGeneratedPlantShaderPrewarmContextRecovery,
} from './lib/plantShaderPrewarm';

const PLANT_SHADER_PREWARM_IDLE_TIMEOUT_MS = 150;
const PLANT_SHADER_PREWARM_FALLBACK_DELAY_MS = 50;

export type GeneratedPlantShaderPrewarmLifecycleStatus =
    | GeneratedPlantShaderPrewarmCompletionStatus
    | 'compiling'
    | 'scheduled';

export interface PlantShaderPrewarmProps {
    compileTimeoutMs?: number;
    enabled?: boolean;
    onComplete?: (result: GeneratedPlantShaderPrewarmResult) => void;
    onStatusChange?: (
        status: GeneratedPlantShaderPrewarmLifecycleStatus,
    ) => void;
    variantKey: string;
}

export function PlantShaderPrewarm({
    compileTimeoutMs = GENERATED_PLANT_SHADER_PREWARM_COMPILE_TIMEOUT_MS,
    enabled = true,
    onComplete,
    onStatusChange,
    variantKey,
}: PlantShaderPrewarmProps) {
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);

    useEffect(() => {
        let active = true;
        let activeAttemptController: AbortController | null = null;
        let attemptId = 0;
        let completed = false;
        let idleCallbackId: number | null = null;
        let fallbackTimeoutId: number | null = null;
        const profileSessionId = enabled
            ? getGeneratedPlantProfileSessionId()
            : null;
        let programCountBefore = gl.info.programs?.length ?? null;

        const cancelScheduledCompile = () => {
            if (idleCallbackId !== null) {
                window.cancelIdleCallback(idleCallbackId);
                idleCallbackId = null;
            }
            if (fallbackTimeoutId !== null) {
                window.clearTimeout(fallbackTimeoutId);
                fallbackTimeoutId = null;
            }
        };

        const cancelActiveAttempt = () => {
            attemptId += 1;
            activeAttemptController?.abort();
            activeAttemptController = null;
            completed = false;
        };

        const compile = () => {
            idleCallbackId = null;
            fallbackTimeoutId = null;
            if (!active) {
                return;
            }

            cancelActiveAttempt();
            const currentAttemptId = attemptId;
            const controller = new AbortController();
            activeAttemptController = controller;
            programCountBefore = gl.info.programs?.length ?? null;
            onStatusChange?.('compiling');
            const request = requestGeneratedPlantShaderPrewarm({
                camera,
                compiler: {
                    compileAsync: (object, compileCamera, targetScene) =>
                        gl.compileAsync(object, compileCamera, targetScene),
                    isContextLost: () => gl.getContext().isContextLost(),
                },
                renderer: gl,
                scene,
                signal: controller.signal,
                timeoutMs: compileTimeoutMs,
                variantKey,
            });
            if (profileSessionId !== null) {
                recordGeneratedPlantProfileShaderPrewarm({
                    deduplicated: request.deduplicated,
                    programCountBefore,
                    sessionId: profileSessionId,
                    status: 'compiling',
                });
            }
            void request.completion.then((result) => {
                if (!active || attemptId !== currentAttemptId) {
                    return;
                }

                activeAttemptController = null;
                completed = true;
                if (profileSessionId !== null) {
                    recordGeneratedPlantProfileShaderPrewarm({
                        deduplicated: result.deduplicated,
                        durationMs: result.durationMs,
                        programCountAfter: gl.info.programs?.length ?? null,
                        programCountBefore,
                        sessionId: profileSessionId,
                        status: result.status,
                    });
                }
                onStatusChange?.(result.status);
                onComplete?.(result);
            });
        };

        const scheduleCompile = () => {
            if (!active) {
                return;
            }

            cancelScheduledCompile();
            completed = false;
            programCountBefore = gl.info.programs?.length ?? null;
            if (profileSessionId !== null) {
                recordGeneratedPlantProfileShaderPrewarm({
                    programCountBefore,
                    sessionId: profileSessionId,
                    status: 'scheduled',
                });
            }
            onStatusChange?.('scheduled');

            if (typeof window.requestIdleCallback === 'function') {
                idleCallbackId = window.requestIdleCallback(compile, {
                    timeout: PLANT_SHADER_PREWARM_IDLE_TIMEOUT_MS,
                });
            } else {
                fallbackTimeoutId = window.setTimeout(
                    compile,
                    PLANT_SHADER_PREWARM_FALLBACK_DELAY_MS,
                );
            }
        };

        const unsubscribeContextRecovery =
            subscribeToGeneratedPlantShaderPrewarmContextRecovery({
                eventTarget: gl.domElement,
                onContextLost: () => {
                    cancelScheduledCompile();
                    cancelActiveAttempt();
                },
                onContextRestored: () => {
                    if (enabled) {
                        scheduleCompile();
                    }
                },
                renderer: gl,
            });
        if (enabled) {
            scheduleCompile();
        }

        return () => {
            if (!completed && profileSessionId !== null) {
                recordGeneratedPlantProfileShaderPrewarm({
                    programCountAfter: gl.info.programs?.length ?? null,
                    programCountBefore,
                    sessionId: profileSessionId,
                    status: 'cancelled',
                });
            }
            active = false;
            unsubscribeContextRecovery();
            cancelScheduledCompile();
            cancelActiveAttempt();
        };
    }, [
        camera,
        compileTimeoutMs,
        enabled,
        gl,
        onComplete,
        onStatusChange,
        scene,
        variantKey,
    ]);

    return null;
}
