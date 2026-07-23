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

export async function requestGeneratedLSystemSymbolsBatch(
    tasks: LSystemGenerationTask[],
) {
    const results = Array<LSystemSymbol[] | null>(tasks.length).fill(null);
    const missingTasks: LSystemGenerationTask[] = [];
    const missingKeys: string[] = [];
    const missingIndexes: number[] = [];

    tasks.forEach((task, index) => {
        const key = getLSystemGenerationTaskKey(task);
        const cachedSymbols = lSystemCache.get(key);

        if (cachedSymbols) {
            results[index] = cachedSymbols;
            return;
        }

        missingTasks.push(task);
        missingKeys.push(key);
        missingIndexes.push(index);
    });
    const profileActive = isGeneratedPlantProfileActive();
    recordGeneratedPlantProfileLSystemRequest({
        requestedTaskCount: tasks.length,
        workerTaskCount: missingTasks.length,
    });
    const workerStartedAt = profileActive ? performance.now() : 0;
    let workerFailed = false;

    if (missingTasks.length > 0) {
        let generatedSymbols: LSystemSymbol[][];

        try {
            generatedSymbols = await runWorkerTasks(missingTasks);
        } catch {
            workerFailed = true;
            generatedSymbols = missingTasks.map(generateSymbolsSync);
        }

        generatedSymbols.forEach((symbols, index) => {
            const resultIndex = missingIndexes[index];
            const key = missingKeys[index];

            lSystemCache.set(key, symbols);
            results[resultIndex] = symbols;
        });
    }
    recordGeneratedPlantProfileLSystemCompletion({
        completedTaskCount: tasks.length,
        durationMs:
            profileActive && missingTasks.length > 0
                ? performance.now() - workerStartedAt
                : 0,
        workerFailed,
    });

    return results as LSystemSymbol[][];
}

interface UseGeneratedLSystemSymbolsOptions {
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

        let cancelled = false;
        let settled = false;
        setIsPending(true);

        requestGeneratedLSystemSymbolsBatch([task]).then(([nextSymbols]) => {
            settled = true;
            if (cancelled) {
                return;
            }

            startTransition(() => {
                setResult({ symbols: nextSymbols, taskKey });
            });
            setIsPending(false);
        });

        return () => {
            cancelled = true;
            if (!settled) {
                recordGeneratedPlantProfileLSystemCancellation(1);
            }
        };
    }, [symbols, task, taskKey]);

    return {
        isPending: isPending || symbols === null,
        symbols,
    };
}

export function useGeneratedLSystemSymbolsBatch(
    tasks: LSystemGenerationTask[],
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

        let cancelled = false;
        let settled = false;
        requestGeneratedLSystemSymbolsBatch(missingTasks).then((results) => {
            settled = true;
            if (cancelled) {
                return;
            }

            const nextEntries = Object.fromEntries(
                results.map((symbols, index) => [missingKeys[index], symbols]),
            );

            startTransition(() => {
                setSymbolsByKey((current) =>
                    reconcileGeneratedLSystemBatchState(
                        current,
                        taskKeys,
                        nextEntries,
                    ),
                );
            });
            setIsPending(false);
        });

        return () => {
            cancelled = true;
            if (!settled) {
                recordGeneratedPlantProfileLSystemCancellation(
                    missingTasks.length,
                );
            }
        };
    }, [taskKeys, tasks]);

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
