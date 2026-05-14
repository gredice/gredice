'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
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

const lSystemCache = new Map<string, LSystemSymbol[]>();
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

    if (missingTasks.length > 0) {
        let generatedSymbols: LSystemSymbol[][];

        try {
            generatedSymbols = await runWorkerTasks(missingTasks);
        } catch {
            generatedSymbols = missingTasks.map(generateSymbolsSync);
        }

        generatedSymbols.forEach((symbols, index) => {
            const resultIndex = missingIndexes[index];
            const key = missingKeys[index];

            lSystemCache.set(key, symbols);
            results[resultIndex] = symbols;
        });
    }

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
    const [symbols, setSymbols] = useState<LSystemSymbol[] | null>(() => {
        const cachedSymbols = lSystemCache.get(taskKey);
        if (cachedSymbols) {
            return cachedSymbols;
        }

        if (options.syncInitialResult) {
            const initialSymbols = generateSymbolsSync(task);
            lSystemCache.set(taskKey, initialSymbols);
            return initialSymbols;
        }

        return null;
    });
    const [isPending, setIsPending] = useState(!symbols);

    useEffect(() => {
        const cachedSymbols = lSystemCache.get(taskKey);
        if (cachedSymbols) {
            if (symbols !== cachedSymbols) {
                startTransition(() => {
                    setSymbols(cachedSymbols);
                });
            }
            setIsPending(false);
            return;
        }

        let cancelled = false;
        setIsPending(true);

        requestGeneratedLSystemSymbolsBatch([task]).then(([nextSymbols]) => {
            if (cancelled) {
                return;
            }

            startTransition(() => {
                setSymbols(nextSymbols);
            });
            setIsPending(false);
        });

        return () => {
            cancelled = true;
        };
    }, [symbols, task, taskKey]);

    return {
        isPending,
        symbols,
    };
}

export function useGeneratedLSystemSymbolsBatch(
    tasks: LSystemGenerationTask[],
) {
    const taskKeys = tasks.map(getLSystemGenerationTaskKey);
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
                setSymbolsByKey((current) => ({
                    ...current,
                    ...cachedEntries,
                }));
            });
        }

        let cancelled = false;
        setIsPending(taskKeys.some((key) => !lSystemCache.has(key)));

        requestGeneratedLSystemSymbolsBatch(tasks).then((results) => {
            if (cancelled) {
                return;
            }

            const nextEntries = Object.fromEntries(
                results.map((symbols, index) => [taskKeys[index], symbols]),
            );

            startTransition(() => {
                setSymbolsByKey((current) => ({
                    ...current,
                    ...nextEntries,
                }));
            });
            setIsPending(false);
        });

        return () => {
            cancelled = true;
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
