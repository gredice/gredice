'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import {
    isGeneratedPlantProfileActive,
    recordGeneratedPlantProfileLSystemCancellation,
    recordGeneratedPlantProfileLSystemCompletion,
    recordGeneratedPlantProfileLSystemRequest,
} from '../../../scene/generatedPlantProfileMetrics';
import {
    generateLSystemStringWithGenerations,
    type LSystemSymbol,
} from '../lib/l-system';
import {
    getLSystemGenerationTaskKey,
    type LSystemGenerationTask,
    type LSystemWorkerRequest,
    type LSystemWorkerResponse,
} from '../lib/l-system-worker-types';
import { SeededRNG } from '../lib/rng';
import { reconcileGeneratedLSystemBatchState } from './generatedLSystemBatchState';
import { generatedLSystemCache } from './generatedLSystemCache';
import {
    type GeneratedLSystemTaskPriority,
    GeneratedLSystemTaskScheduler,
} from './generatedLSystemTaskScheduler';
import {
    type GeneratedLSystemTaskResult,
    resolveGeneratedLSystemTaskSymbols,
} from './generatedLSystemTaskState';

const lSystemCache = generatedLSystemCache;
const pendingRequests = new Map<
    number,
    {
        reject: (reason?: unknown) => void;
        resolve: (symbols: LSystemSymbol[][]) => void;
    }
>();

let requestCounter = 0;
let workerInstance: Worker | null = null;

function generateSymbolsSync(task: LSystemGenerationTask) {
    return generateLSystemStringWithGenerations(
        task.axiom,
        task.rules,
        task.iterations,
        new SeededRNG(task.seed),
    );
}

function resetWorker(reason?: unknown) {
    workerInstance?.terminate();
    workerInstance = null;

    const currentPending = Array.from(pendingRequests.values());
    pendingRequests.clear();
    currentPending.forEach((request) => {
        request.reject(reason);
    });
}

function getWorker() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
        return null;
    }

    if (workerInstance) {
        return workerInstance;
    }

    workerInstance = new Worker(
        new URL('../workers/l-system.worker.ts', import.meta.url),
        {
            type: 'module',
        },
    );
    workerInstance.onmessage = (event: MessageEvent<LSystemWorkerResponse>) => {
        const pending = pendingRequests.get(event.data.id);
        if (!pending) {
            return;
        }

        pendingRequests.delete(event.data.id);
        pending.resolve(event.data.results);
    };
    workerInstance.onerror = (error) => {
        resetWorker(error);
    };

    return workerInstance;
}

async function runWorkerTasks(tasks: LSystemGenerationTask[]) {
    const worker = getWorker();
    if (!worker) {
        return tasks.map(generateSymbolsSync);
    }

    const requestId = ++requestCounter;
    const request: LSystemWorkerRequest = {
        id: requestId,
        tasks,
    };

    return new Promise<LSystemSymbol[][]>((resolve, reject) => {
        pendingRequests.set(requestId, { resolve, reject });
        worker.postMessage(request);
    });
}

const generatedLSystemTaskScheduler = new GeneratedLSystemTaskScheduler<
    LSystemGenerationTask,
    LSystemSymbol[]
>(async (task) => {
    const profileActive = isGeneratedPlantProfileActive();
    const startedAt = profileActive ? performance.now() : 0;
    let workerFailed = false;
    let symbols: LSystemSymbol[];

    recordGeneratedPlantProfileLSystemRequest({
        requestedTaskCount: 0,
        workerTaskCount: 1,
    });

    try {
        const [workerSymbols] = await runWorkerTasks([task]);
        if (!workerSymbols) {
            throw new Error('L-system worker returned no task result');
        }
        symbols = workerSymbols;
    } catch {
        workerFailed = true;
        symbols = generateSymbolsSync(task);
    }

    lSystemCache.set(getLSystemGenerationTaskKey(task), symbols);
    recordGeneratedPlantProfileLSystemCompletion({
        completedTaskCount: 0,
        durationMs: profileActive ? performance.now() - startedAt : 0,
        workerFailed,
    });
    return symbols;
});

function isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError';
}

interface RequestGeneratedLSystemSymbolsOptions {
    priority?: GeneratedLSystemTaskPriority;
    signal?: AbortSignal;
}

async function requestGeneratedLSystemSymbols(
    task: LSystemGenerationTask,
    options: RequestGeneratedLSystemSymbolsOptions = {},
) {
    const taskKey = getLSystemGenerationTaskKey(task);
    recordGeneratedPlantProfileLSystemRequest({
        requestedTaskCount: 1,
        workerTaskCount: 0,
    });
    const cachedSymbols = lSystemCache.get(taskKey);
    if (cachedSymbols) {
        recordGeneratedPlantProfileLSystemCompletion({
            completedTaskCount: 1,
            durationMs: 0,
        });
        return cachedSymbols;
    }

    try {
        const symbols = await generatedLSystemTaskScheduler.schedule({
            key: taskKey,
            priority: options.priority,
            signal: options.signal,
            task,
        });
        recordGeneratedPlantProfileLSystemCompletion({
            completedTaskCount: 1,
            durationMs: 0,
        });
        return symbols;
    } catch (error) {
        if (isAbortError(error)) {
            recordGeneratedPlantProfileLSystemCancellation(1);
        }
        throw error;
    }
}

export async function requestGeneratedLSystemSymbolsBatch(
    tasks: LSystemGenerationTask[],
    options: RequestGeneratedLSystemSymbolsOptions = {},
) {
    return Promise.all(
        tasks.map((task) => requestGeneratedLSystemSymbols(task, options)),
    );
}

interface UseGeneratedLSystemSymbolsOptions {
    priority?: GeneratedLSystemTaskPriority;
    syncInitialResult?: boolean;
}

export function useGeneratedLSystemSymbols(
    task: LSystemGenerationTask,
    options: UseGeneratedLSystemSymbolsOptions = {},
) {
    const taskKey = getLSystemGenerationTaskKey(task);
    const [result, setResult] = useState<GeneratedLSystemTaskResult | null>(
        () => {
            const cachedSymbols = lSystemCache.get(taskKey);
            if (cachedSymbols) {
                return { symbols: cachedSymbols, taskKey };
            }

            if (options.syncInitialResult) {
                const initialSymbols = generateSymbolsSync(task);
                lSystemCache.set(taskKey, initialSymbols);
                return { symbols: initialSymbols, taskKey };
            }

            return null;
        },
    );
    const symbols = resolveGeneratedLSystemTaskSymbols(result, taskKey);
    const [isPending, setIsPending] = useState(!symbols);

    useEffect(() => {
        if (symbols) {
            setIsPending(false);
            return;
        }

        const cachedSymbols = lSystemCache.get(taskKey);
        if (cachedSymbols) {
            startTransition(() => {
                setResult({ symbols: cachedSymbols, taskKey });
            });
            setIsPending(false);
            return;
        }

        const controller = new AbortController();
        setIsPending(true);

        requestGeneratedLSystemSymbols(task, {
            priority: options.priority,
            signal: controller.signal,
        })
            .then((nextSymbols) => {
                if (controller.signal.aborted) {
                    return;
                }

                startTransition(() => {
                    setResult({ symbols: nextSymbols, taskKey });
                });
                setIsPending(false);
            })
            .catch((error: unknown) => {
                if (!isAbortError(error)) {
                    setIsPending(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [options.priority, symbols, task, taskKey]);

    return {
        isPending: isPending || symbols === null,
        symbols,
    };
}

export function useGeneratedLSystemSymbolsBatch(
    tasks: LSystemGenerationTask[],
    options: Pick<UseGeneratedLSystemSymbolsOptions, 'priority'> = {},
) {
    const taskKeys = useMemo(
        () => tasks.map(getLSystemGenerationTaskKey),
        [tasks],
    );
    const [symbolsByKey, setSymbolsByKey] = useState<
        Record<string, LSystemSymbol[]>
    >(() =>
        Object.fromEntries(
            taskKeys.flatMap((key) => {
                const cachedSymbols = lSystemCache.get(key);
                return cachedSymbols ? [[key, cachedSymbols]] : [];
            }),
        ),
    );
    const [isPending, setIsPending] = useState(
        () =>
            tasks.length > 0 && taskKeys.some((key) => !lSystemCache.has(key)),
    );

    useEffect(() => {
        if (tasks.length === 0) {
            setIsPending(false);
            return;
        }

        const cachedEntries = Object.fromEntries(
            taskKeys.flatMap((key) => {
                const cachedSymbols = lSystemCache.get(key);
                return cachedSymbols ? [[key, cachedSymbols]] : [];
            }),
        );
        if (Object.keys(cachedEntries).length > 0) {
            startTransition(() => {
                setSymbolsByKey((current) =>
                    reconcileGeneratedLSystemBatchState(
                        current,
                        taskKeys,
                        cachedEntries,
                    ),
                );
            });
        }

        const missingTasks: LSystemGenerationTask[] = [];
        const missingKeys: string[] = [];
        tasks.forEach((task, index) => {
            if (lSystemCache.has(taskKeys[index])) {
                return;
            }

            missingTasks.push(task);
            missingKeys.push(taskKeys[index]);
        });

        setIsPending(missingTasks.length > 0);
        if (missingTasks.length === 0) {
            return;
        }

        const controller = new AbortController();
        let remainingTaskCount = missingTasks.length;

        missingTasks.forEach((task, index) => {
            const missingKey = missingKeys[index];
            if (!missingKey) {
                return;
            }

            requestGeneratedLSystemSymbols(task, {
                priority: options.priority,
                signal: controller.signal,
            })
                .then((nextSymbols) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    startTransition(() => {
                        setSymbolsByKey((current) =>
                            reconcileGeneratedLSystemBatchState(
                                current,
                                taskKeys,
                                {
                                    [missingKey]: nextSymbols,
                                },
                            ),
                        );
                    });
                    remainingTaskCount -= 1;
                    if (remainingTaskCount === 0) {
                        setIsPending(false);
                    }
                })
                .catch((error: unknown) => {
                    if (controller.signal.aborted || isAbortError(error)) {
                        return;
                    }

                    remainingTaskCount -= 1;
                    if (remainingTaskCount === 0) {
                        setIsPending(false);
                    }
                });
        });

        return () => {
            controller.abort();
        };
    }, [options.priority, taskKeys, tasks]);

    const symbols = useMemo(() => {
        return taskKeys.map(
            (key) => symbolsByKey[key] ?? lSystemCache.get(key) ?? null,
        );
    }, [symbolsByKey, taskKeys]);

    return {
        isPending,
        symbols,
    };
}

export function getGeneratedLSystemTaskSchedulerSnapshot() {
    return generatedLSystemTaskScheduler.snapshot();
}
