'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import {
    getGeneratedPlantProfileSessionId,
    recordGeneratedPlantProfileShaderPrewarm,
} from '../../scene/generatedPlantProfileMetrics';
import { useSceneRuntimeVisible } from '../../scene/SceneTime';
import {
    GENERATED_PLANT_SHADER_PREWARM_COMPILE_TIMEOUT_MS,
    type GeneratedPlantShaderPrewarmLifecycleStatus,
    type GeneratedPlantShaderPrewarmResult,
    getGeneratedPlantShaderProgramDiagnostics,
    publishGeneratedPlantShaderPrewarmLifecycleStatus,
    requestGeneratedPlantShaderPrewarm,
    subscribeToGeneratedPlantShaderPrewarmContextRecovery,
} from './lib/plantShaderPrewarm';

export type { GeneratedPlantShaderPrewarmLifecycleStatus } from './lib/plantShaderPrewarm';

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
    const runtimeVisible = useSceneRuntimeVisible();
    const runtimeEnabled = enabled && runtimeVisible;

    useEffect(() => {
        let active = true;
        let activeAttemptController: AbortController | null = null;
        let attemptId = 0;
        let completed = false;
        const profileSessionId = runtimeEnabled
            ? getGeneratedPlantProfileSessionId()
            : null;
        let programCountBefore = gl.info.programs?.length ?? null;

        const publishStatus = (
            status: GeneratedPlantShaderPrewarmLifecycleStatus | null,
        ) => {
            publishGeneratedPlantShaderPrewarmLifecycleStatus({
                renderer: gl,
                status,
                variantKey,
            });
            if (status !== null) {
                onStatusChange?.(status);
            }
        };

        const cancelActiveAttempt = () => {
            attemptId += 1;
            activeAttemptController?.abort();
            activeAttemptController = null;
            completed = false;
        };

        const compile = () => {
            if (!active) {
                return;
            }

            cancelActiveAttempt();
            const currentAttemptId = attemptId;
            const controller = new AbortController();
            activeAttemptController = controller;
            programCountBefore = gl.info.programs?.length ?? null;
            publishStatus('compiling');
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
                        programsAfter:
                            getGeneratedPlantShaderProgramDiagnostics(
                                gl.info.programs,
                            ),
                        sessionId: profileSessionId,
                        status: result.status,
                    });
                }
                publishStatus(result.status);
                onComplete?.(result);
            });
        };

        const scheduleCompile = () => {
            if (!active) {
                return;
            }

            completed = false;
            programCountBefore = gl.info.programs?.length ?? null;
            if (profileSessionId !== null) {
                recordGeneratedPlantProfileShaderPrewarm({
                    programCountBefore,
                    sessionId: profileSessionId,
                    status: 'scheduled',
                });
            }
            publishStatus('scheduled');
            compile();
        };

        const unsubscribeContextRecovery =
            subscribeToGeneratedPlantShaderPrewarmContextRecovery({
                eventTarget: gl.domElement,
                onContextLost: () => {
                    cancelActiveAttempt();
                    publishStatus(null);
                },
                onContextRestored: () => {
                    if (runtimeEnabled) {
                        scheduleCompile();
                    }
                },
                renderer: gl,
            });
        if (runtimeEnabled) {
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
            cancelActiveAttempt();
            publishStatus(null);
        };
    }, [
        camera,
        compileTimeoutMs,
        gl,
        onComplete,
        onStatusChange,
        runtimeEnabled,
        scene,
        variantKey,
    ]);

    return null;
}
