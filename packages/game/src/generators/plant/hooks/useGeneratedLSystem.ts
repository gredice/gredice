'use client';

import {
    startTransition,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    getGeneratedPlantProfileSessionId,
    recordGeneratedPlantProfileLSystemCancellation,
    recordGeneratedPlantProfileLSystemCompletion,
    recordGeneratedPlantProfileLSystemRequest,
    recordGeneratedPlantProfileLSystemSyncFallback,
    recordGeneratedPlantProfilePackedWorkerResult,
    recordGeneratedPlantProfileSchedulerSnapshot,
    recordGeneratedPlantProfileTemplateCacheSnapshot,
} from '../../../scene/generatedPlantProfileMetrics';
import { buildPlantRenderData } from '../lib/buildPlantRenderData';
import {
    generateLSystemStringWithGenerations,
    type LSystemSymbol,
} from '../lib/l-system';
import {
    getLSystemGenerationTaskKey,
    type LSystemGenerationTask,
    type LSystemWorkerRequest,
    type LSystemWorkerResponse,
    PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
    PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND,
    type PackedPlantRenderWorkerRequest,
    type PackedPlantRenderWorkerResponse,
    type PackedPlantRenderWorkerTaskV1,
    type PackedPlantRenderWorkerTemplateCacheMetricsV1,
} from '../lib/l-system-worker-types';
import {
    mergePackedPlantRenderDataInstances,
    type PackedPlantRenderData,
    packPlantRenderData,
} from '../lib/packedPlantRenderData';
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
import {
    generatedPlantTemplateCacheMaxEntryCount,
    generatedPlantTemplateCacheMaxEstimatedBytes,
} from './generatedPlantTemplateCache';
import {
    type PackedPlantWorkerExecutionResult,
    runPackedPlantWorkerWithRetry,
} from './packedPlantWorkerRetry';

const lSystemCache = generatedLSystemCache;
const pendingRequests = new Map<
    number,
    {
        expectedResultCount: number;
        reject: (reason?: unknown) => void;
        resolve: (symbols: LSystemSymbol[][]) => void;
    }
>();
const pendingPackedRequests = new Map<
    number,
    {
        expectedResultCount: number;
        reject: (reason?: unknown) => void;
        resolve: (response: PackedPlantRenderWorkerResponse) => void;
    }
>();

let requestCounter = 0;
let workerInstance: Worker | null = null;

class LSystemWorkerRuntimeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LSystemWorkerRuntimeError';
    }
}

class LSystemWorkerProtocolError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LSystemWorkerProtocolError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isTemplateCacheDelta(value: unknown) {
    return (
        isRecord(value) &&
        isNonNegativeFiniteNumber(value.evictionCount) &&
        isNonNegativeFiniteNumber(value.hitCount) &&
        isNonNegativeFiniteNumber(value.missCount) &&
        isNonNegativeFiniteNumber(value.oversizeSkipCount) &&
        isNonNegativeFiniteNumber(value.writeCount)
    );
}

function isTemplateCacheSnapshot(value: unknown) {
    return (
        isRecord(value) &&
        isTemplateCacheDelta(value) &&
        isNonNegativeFiniteNumber(value.entryCount) &&
        isNonNegativeFiniteNumber(value.estimatedBytes) &&
        isNonNegativeFiniteNumber(value.maxEntryCount) &&
        isNonNegativeFiniteNumber(value.maxEstimatedBytes) &&
        isNonNegativeFiniteNumber(value.peakEstimatedBytes)
    );
}

function isPackedPlantRenderWorkerResponse(
    value: unknown,
): value is PackedPlantRenderWorkerResponse {
    if (!isRecord(value) || !isRecord(value.timings)) {
        return false;
    }

    const templateCache = value.templateCache;
    return (
        Number.isInteger(value.id) &&
        value.kind === PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND &&
        value.version === PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION &&
        Array.isArray(value.results) &&
        isNonNegativeFiniteNumber(value.transferByteLength) &&
        isNonNegativeFiniteNumber(value.timings.packingDurationMs) &&
        isNonNegativeFiniteNumber(value.timings.renderDataBuildDurationMs) &&
        isNonNegativeFiniteNumber(value.timings.rootBatchingDurationMs) &&
        isNonNegativeFiniteNumber(value.timings.symbolGenerationDurationMs) &&
        isNonNegativeFiniteNumber(value.timings.totalDurationMs) &&
        isRecord(templateCache) &&
        isTemplateCacheDelta(templateCache.delta) &&
        isTemplateCacheSnapshot(templateCache.snapshot)
    );
}

function isLSystemWorkerResponse(
    value: unknown,
): value is LSystemWorkerResponse {
    return (
        isRecord(value) &&
        Number.isInteger(value.id) &&
        !('kind' in value) &&
        Array.isArray(value.results)
    );
}

function isWorkerRuntimeError(error: unknown) {
    return error instanceof LSystemWorkerRuntimeError;
}

function generateSymbolsSync(task: LSystemGenerationTask) {
    return generateLSystemStringWithGenerations(
        task.axiom,
        task.rules,
        task.iterations,
        new SeededRNG(task.seed),
    );
}

function generatePackedPlantRenderDataSync(
    task: PackedPlantRenderWorkerTaskV1,
) {
    const symbols = generateSymbolsSync(task.generationTask);
    const template = packPlantRenderData(
        buildPlantRenderData({
            flowerGrowth: task.flowerGrowth,
            fruitGrowth: task.fruitGrowth,
            generation: task.generation,
            lSystemSymbols: symbols,
            plantDefinition: task.plantDefinition,
            renderDetailedGeometry: true,
            seed: task.generationTask.seed,
            showFlowers: task.showFlowers,
            showLeaves: task.showLeaves,
            showProduce: task.showProduce,
        }),
    );
    if (!task.rootTransforms || task.rootTransforms.length === 0) {
        return template;
    }

    return mergePackedPlantRenderDataInstances(
        task.rootTransforms.map((transform) => ({ template, transform })),
    );
}

function resetWorker(reason?: unknown, expectedWorker?: Worker) {
    if (expectedWorker && workerInstance !== expectedWorker) {
        return;
    }

    workerInstance?.terminate();
    workerInstance = null;

    const currentPending = Array.from(pendingRequests.values());
    pendingRequests.clear();
    currentPending.forEach((request) => {
        request.reject(reason);
    });
    const currentPackedPending = Array.from(pendingPackedRequests.values());
    pendingPackedRequests.clear();
    currentPackedPending.forEach((request) => {
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

    let worker: Worker;
    try {
        worker = new Worker(
            new URL('../workers/l-system.worker.ts', import.meta.url),
            {
                type: 'module',
            },
        );
    } catch {
        return null;
    }

    workerInstance = worker;
    worker.onmessage = (event: MessageEvent<unknown>) => {
        const response = event.data;
        const responseId =
            isRecord(response) &&
            typeof response.id === 'number' &&
            Number.isInteger(response.id)
                ? response.id
                : null;
        if (responseId === null) {
            if (pendingRequests.size > 0 || pendingPackedRequests.size > 0) {
                resetWorker(
                    new LSystemWorkerProtocolError(
                        'Worker response did not include a valid request id',
                    ),
                    worker,
                );
            }
            return;
        }

        const packedPending = pendingPackedRequests.get(responseId);
        if (packedPending) {
            if (
                !isPackedPlantRenderWorkerResponse(response) ||
                response.results.length !== packedPending.expectedResultCount
            ) {
                resetWorker(
                    new LSystemWorkerProtocolError(
                        `Packed worker response ${responseId} did not match its request protocol`,
                    ),
                    worker,
                );
                return;
            }

            pendingPackedRequests.delete(responseId);
            packedPending.resolve(response);
            return;
        }

        const pending = pendingRequests.get(responseId);
        if (pending) {
            if (
                !isLSystemWorkerResponse(response) ||
                response.results.length !== pending.expectedResultCount
            ) {
                resetWorker(
                    new LSystemWorkerProtocolError(
                        `L-system worker response ${responseId} did not match its request protocol`,
                    ),
                    worker,
                );
                return;
            }

            pendingRequests.delete(responseId);
            pending.resolve(response.results);
        }
    };
    worker.onerror = (event) => {
        const message =
            typeof event.message === 'string' && event.message.length > 0
                ? event.message
                : 'L-system worker failed at runtime';
        resetWorker(new LSystemWorkerRuntimeError(message), worker);
    };
    worker.onmessageerror = () => {
        resetWorker(
            new LSystemWorkerRuntimeError(
                'L-system worker response could not be deserialized',
            ),
            worker,
        );
    };

    return worker;
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
        pendingRequests.set(requestId, {
            expectedResultCount: tasks.length,
            reject,
            resolve,
        });
        try {
            worker.postMessage(request);
        } catch (error) {
            pendingRequests.delete(requestId);
            reject(error);
        }
    });
}

function getEmptyTemplateCacheMetrics(): PackedPlantRenderWorkerTemplateCacheMetricsV1 {
    return {
        delta: {
            evictionCount: 0,
            hitCount: 0,
            missCount: 0,
            oversizeSkipCount: 0,
            writeCount: 0,
        },
        snapshot: {
            entryCount: 0,
            estimatedBytes: 0,
            evictionCount: 0,
            hitCount: 0,
            maxEntryCount: generatedPlantTemplateCacheMaxEntryCount,
            maxEstimatedBytes: generatedPlantTemplateCacheMaxEstimatedBytes,
            missCount: 0,
            oversizeSkipCount: 0,
            peakEstimatedBytes: 0,
            writeCount: 0,
        },
    };
}

async function runPackedWorkerTasks(
    tasks: PackedPlantRenderWorkerTaskV1[],
    {
        allowSyncFallback = true,
        onWorkerAttemptStarted = () => {},
    }: {
        allowSyncFallback?: boolean;
        onWorkerAttemptStarted?: () => void;
    } = {},
): Promise<PackedPlantWorkerExecutionResult<PackedPlantRenderWorkerResponse>> {
    const worker = getWorker();
    if (!worker) {
        if (!allowSyncFallback) {
            throw new LSystemWorkerRuntimeError(
                'Packed plant worker was unavailable after restart',
            );
        }

        const startedAt =
            typeof performance === 'undefined' ? 0 : performance.now();
        const results = tasks.map(generatePackedPlantRenderDataSync);
        const durationMs =
            typeof performance === 'undefined'
                ? 0
                : Math.max(0, performance.now() - startedAt);

        return {
            executionKind: 'sync-fallback',
            response: {
                id: 0,
                kind: PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND,
                results,
                templateCache: getEmptyTemplateCacheMetrics(),
                timings: {
                    packingDurationMs: 0,
                    renderDataBuildDurationMs: durationMs,
                    rootBatchingDurationMs: 0,
                    symbolGenerationDurationMs: 0,
                    totalDurationMs: durationMs,
                },
                transferByteLength: 0,
                version: PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
            },
        };
    }

    const requestId = ++requestCounter;
    const request: PackedPlantRenderWorkerRequest = {
        id: requestId,
        kind: PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
        tasks,
        version: PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    };

    const response = await new Promise<PackedPlantRenderWorkerResponse>(
        (resolve, reject) => {
            pendingPackedRequests.set(requestId, {
                expectedResultCount: tasks.length,
                reject,
                resolve,
            });
            try {
                onWorkerAttemptStarted();
                worker.postMessage(request);
            } catch (error) {
                pendingPackedRequests.delete(requestId);
                reject(error);
            }
        },
    );

    return {
        executionKind: 'worker',
        response,
    };
}

const generatedLSystemTaskScheduler = new GeneratedLSystemTaskScheduler<
    LSystemGenerationTask,
    LSystemSymbol[]
>(async (task) => {
    const sessionId = getGeneratedPlantProfileSessionId();
    const profileActive = sessionId !== null;
    const startedAt = profileActive ? performance.now() : 0;
    let workerFailed = false;
    let symbols: LSystemSymbol[];

    if (sessionId !== null) {
        recordGeneratedPlantProfileLSystemRequest({
            requestedTaskCount: 0,
            sessionId,
            workerTaskCount: 1,
        });
    }

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
    if (sessionId !== null) {
        recordGeneratedPlantProfileLSystemCompletion({
            completedTaskCount: 0,
            durationMs: performance.now() - startedAt,
            sessionId,
            workerFailed,
        });
    }
    return symbols;
});

let templateCacheProfileSessionId: number | null = null;
let templateCacheProfileCounters:
    | PackedPlantRenderWorkerTemplateCacheMetricsV1['delta']
    | null = null;
let templateCacheProfilePeakEstimatedBytes = 0;

function recordWorkerTemplateCacheProfile(
    metrics: PackedPlantRenderWorkerTemplateCacheMetricsV1,
    sessionId: number | null,
) {
    if (
        sessionId === null ||
        getGeneratedPlantProfileSessionId() !== sessionId
    ) {
        return;
    }

    const { delta, snapshot } = metrics;
    if (
        templateCacheProfileSessionId !== sessionId ||
        templateCacheProfileCounters === null
    ) {
        templateCacheProfileSessionId = sessionId;
        templateCacheProfileCounters = {
            evictionCount: 0,
            hitCount: 0,
            missCount: 0,
            oversizeSkipCount: 0,
            writeCount: 0,
        };
        templateCacheProfilePeakEstimatedBytes = 0;
        recordGeneratedPlantProfileTemplateCacheSnapshot(
            {
                ...snapshot,
                evictionCount: 0,
                hitCount: 0,
                missCount: 0,
                oversizeSkipCount: 0,
                peakEstimatedBytes: 0,
                writeCount: 0,
            },
            sessionId,
        );
    }

    templateCacheProfileCounters = {
        evictionCount:
            templateCacheProfileCounters.evictionCount + delta.evictionCount,
        hitCount: templateCacheProfileCounters.hitCount + delta.hitCount,
        missCount: templateCacheProfileCounters.missCount + delta.missCount,
        oversizeSkipCount:
            templateCacheProfileCounters.oversizeSkipCount +
            delta.oversizeSkipCount,
        writeCount: templateCacheProfileCounters.writeCount + delta.writeCount,
    };
    templateCacheProfilePeakEstimatedBytes = Math.max(
        templateCacheProfilePeakEstimatedBytes,
        snapshot.estimatedBytes,
        snapshot.peakEstimatedBytes,
    );
    recordGeneratedPlantProfileTemplateCacheSnapshot(
        {
            ...snapshot,
            ...templateCacheProfileCounters,
            peakEstimatedBytes: templateCacheProfilePeakEstimatedBytes,
        },
        sessionId,
    );
}

function recordPackedSchedulerSnapshot(sessionId: number | null) {
    if (
        sessionId === null ||
        getGeneratedPlantProfileSessionId() !== sessionId
    ) {
        return;
    }

    recordGeneratedPlantProfileSchedulerSnapshot(
        generatedPackedPlantRenderTaskScheduler.snapshot(),
        sessionId,
    );
}

interface ScheduledPackedPlantRenderWorkerTask {
    profileSessionId: number | null;
    workerTask: PackedPlantRenderWorkerTaskV1;
}

const generatedPackedPlantRenderTaskScheduler =
    new GeneratedLSystemTaskScheduler<
        ScheduledPackedPlantRenderWorkerTask,
        PackedPlantRenderData
    >(async ({ profileSessionId: sessionId, workerTask }) => {
        const { executionKind, response, workerDurationMs } =
            await runPackedPlantWorkerWithRetry({
                execute: ({ allowSyncFallback, onWorkerAttemptStarted }) =>
                    runPackedWorkerTasks([workerTask], {
                        allowSyncFallback,
                        onWorkerAttemptStarted,
                    }),
                isRuntimeError: isWorkerRuntimeError,
                onWorkerAttemptFailed:
                    sessionId === null
                        ? undefined
                        : (durationMs) => {
                              recordGeneratedPlantProfileLSystemCompletion({
                                  completedTaskCount: 0,
                                  durationMs,
                                  sessionId,
                                  workerFailed: true,
                              });
                          },
                onWorkerAttemptStarted:
                    sessionId === null
                        ? undefined
                        : () => {
                              recordGeneratedPlantProfileLSystemRequest({
                                  requestedTaskCount: 0,
                                  sessionId,
                                  workerTaskCount: 1,
                              });
                          },
            });
        if (
            executionKind === 'sync-fallback' &&
            sessionId !== null &&
            getGeneratedPlantProfileSessionId() === sessionId
        ) {
            recordGeneratedPlantProfileLSystemSyncFallback(1, sessionId);
        }
        const [result] = response.results;
        if (!result) {
            if (executionKind === 'worker' && sessionId !== null) {
                recordGeneratedPlantProfileLSystemCompletion({
                    completedTaskCount: 0,
                    durationMs:
                        workerDurationMs ?? response.timings.totalDurationMs,
                    sessionId,
                    workerFailed: true,
                });
            }
            throw new Error('Packed plant worker returned no task result');
        }

        if (
            executionKind === 'worker' &&
            sessionId !== null &&
            getGeneratedPlantProfileSessionId() === sessionId
        ) {
            recordGeneratedPlantProfilePackedWorkerResult({
                sessionId,
                timings: response.timings,
                transferByteLength: response.transferByteLength,
            });
            recordGeneratedPlantProfileLSystemCompletion({
                completedTaskCount: 0,
                durationMs:
                    workerDurationMs ?? response.timings.totalDurationMs,
                sessionId,
            });
            recordWorkerTemplateCacheProfile(response.templateCache, sessionId);
        }
        return result;
    });

function isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError';
}

export interface GeneratedPackedPlantRenderTask {
    cacheKey: string;
    templateKey: string;
    workerTask: PackedPlantRenderWorkerTaskV1;
}

async function requestGeneratedPackedPlantRenderData(
    { cacheKey, templateKey, workerTask }: GeneratedPackedPlantRenderTask,
    options: RequestGeneratedLSystemSymbolsOptions = {},
) {
    const sessionId = getGeneratedPlantProfileSessionId();
    if (sessionId !== null) {
        recordGeneratedPlantProfileLSystemRequest({
            requestedTaskCount: 1,
            sessionId,
            workerTaskCount: 0,
        });
    }
    const scheduled = generatedPackedPlantRenderTaskScheduler.schedule({
        key: cacheKey,
        priority: options.priority,
        signal: options.signal,
        task: {
            profileSessionId: sessionId,
            workerTask: {
                ...workerTask,
                templateKey,
            },
        },
    });
    recordPackedSchedulerSnapshot(sessionId);

    try {
        const result = await scheduled;
        if (sessionId !== null) {
            recordGeneratedPlantProfileLSystemCompletion({
                completedTaskCount: 1,
                durationMs: 0,
                sessionId,
            });
        }
        return result;
    } catch (error) {
        if (isAbortError(error) && sessionId !== null) {
            recordGeneratedPlantProfileLSystemCancellation(1, sessionId);
        }
        throw error;
    } finally {
        recordPackedSchedulerSnapshot(sessionId);
    }
}

interface RequestGeneratedLSystemSymbolsOptions {
    priority?: GeneratedLSystemTaskPriority;
    signal?: AbortSignal;
}

async function requestGeneratedLSystemSymbols(
    task: LSystemGenerationTask,
    options: RequestGeneratedLSystemSymbolsOptions = {},
) {
    const sessionId = getGeneratedPlantProfileSessionId();
    const taskKey = getLSystemGenerationTaskKey(task);
    if (sessionId !== null) {
        recordGeneratedPlantProfileLSystemRequest({
            requestedTaskCount: 1,
            sessionId,
            workerTaskCount: 0,
        });
    }
    const cachedSymbols = lSystemCache.get(taskKey);
    if (cachedSymbols) {
        if (sessionId !== null) {
            recordGeneratedPlantProfileLSystemCompletion({
                completedTaskCount: 1,
                durationMs: 0,
                sessionId,
            });
        }
        return cachedSymbols;
    }

    try {
        const symbols = await generatedLSystemTaskScheduler.schedule({
            key: taskKey,
            priority: options.priority,
            signal: options.signal,
            task,
        });
        if (sessionId !== null) {
            recordGeneratedPlantProfileLSystemCompletion({
                completedTaskCount: 1,
                durationMs: 0,
                sessionId,
            });
        }
        return symbols;
    } catch (error) {
        if (isAbortError(error) && sessionId !== null) {
            recordGeneratedPlantProfileLSystemCancellation(1, sessionId);
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

function reconcilePackedPlantRenderState(
    current: Record<string, PackedPlantRenderData>,
    activeKeys: string[],
    incoming: Record<string, PackedPlantRenderData>,
) {
    const activeKeySet = new Set(activeKeys);
    const next: Record<string, PackedPlantRenderData> = {};
    let changed = Object.keys(current).some((key) => !activeKeySet.has(key));

    for (const key of activeKeySet) {
        const value = incoming[key] ?? current[key];
        if (value) {
            next[key] = value;
        }
        if (value !== current[key]) {
            changed = true;
        }
    }

    return changed ? next : current;
}

export function useGeneratedPackedPlantRenderDataBatch(
    tasks: GeneratedPackedPlantRenderTask[],
    options: Pick<UseGeneratedLSystemSymbolsOptions, 'priority'> = {},
) {
    const taskKeys = useMemo(() => tasks.map((task) => task.cacheKey), [tasks]);
    const taskSignature = useMemo(() => JSON.stringify(taskKeys), [taskKeys]);
    const [resultsByKey, setResultsByKey] = useState<
        Record<string, PackedPlantRenderData>
    >({});
    const resultsByKeyRef = useRef(resultsByKey);
    const settledTaskSignatureRef = useRef<string | null>(null);
    const [isPending, setIsPending] = useState(() => taskKeys.length > 0);
    const [failedTaskKeys, setFailedTaskKeys] = useState<Set<string>>(
        () => new Set(),
    );
    const failedTaskKeysRef = useRef(failedTaskKeys);
    const [retryGeneration, setRetryGeneration] = useState(0);
    const retryFailed = useCallback(() => {
        const next = new Set<string>();
        failedTaskKeysRef.current = next;
        setFailedTaskKeys(next);
        setRetryGeneration((current) => current + 1);
    }, []);
    const releaseSettledResults = useCallback(() => {
        if (taskKeys.length === 0) {
            return;
        }

        settledTaskSignatureRef.current = taskSignature;
        resultsByKeyRef.current = {};
        setResultsByKey({});
        setIsPending(false);
    }, [taskKeys.length, taskSignature]);

    useEffect(() => {
        void retryGeneration;
        if (tasks.length === 0) {
            settledTaskSignatureRef.current = null;
            resultsByKeyRef.current = {};
            failedTaskKeysRef.current = new Set();
            setResultsByKey({});
            setFailedTaskKeys(new Set());
            setIsPending(false);
            return;
        }
        if (settledTaskSignatureRef.current === taskSignature) {
            setIsPending(false);
            return;
        }
        settledTaskSignatureRef.current = null;

        const activeKeySet = new Set(taskKeys);
        const retainedResults = reconcilePackedPlantRenderState(
            resultsByKeyRef.current,
            taskKeys,
            {},
        );
        resultsByKeyRef.current = retainedResults;
        startTransition(() => {
            setResultsByKey(retainedResults);
        });

        const retainedFailedTaskKeys = new Set(
            Array.from(failedTaskKeysRef.current).filter((key) =>
                activeKeySet.has(key),
            ),
        );
        if (retainedFailedTaskKeys.size !== failedTaskKeysRef.current.size) {
            failedTaskKeysRef.current = retainedFailedTaskKeys;
            setFailedTaskKeys(retainedFailedTaskKeys);
        }

        const missingByKey = new Map<string, GeneratedPackedPlantRenderTask>();
        for (const task of tasks) {
            if (
                retainedResults[task.cacheKey] ||
                retainedFailedTaskKeys.has(task.cacheKey) ||
                missingByKey.has(task.cacheKey)
            ) {
                continue;
            }

            missingByKey.set(task.cacheKey, task);
        }

        const missingTasks = Array.from(missingByKey.values());
        setIsPending(missingTasks.length > 0);
        if (missingTasks.length === 0) {
            return;
        }

        const controller = new AbortController();
        let remainingTaskCount = missingTasks.length;

        for (const task of missingTasks) {
            requestGeneratedPackedPlantRenderData(task, {
                priority: options.priority,
                signal: controller.signal,
            })
                .then((result) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    const nextResults = reconcilePackedPlantRenderState(
                        resultsByKeyRef.current,
                        taskKeys,
                        {
                            [task.cacheKey]: result,
                        },
                    );
                    resultsByKeyRef.current = nextResults;
                    let nextFailedTaskKeys = failedTaskKeysRef.current;
                    if (nextFailedTaskKeys.has(task.cacheKey)) {
                        nextFailedTaskKeys = new Set(nextFailedTaskKeys);
                        nextFailedTaskKeys.delete(task.cacheKey);
                        failedTaskKeysRef.current = nextFailedTaskKeys;
                    }
                    startTransition(() => {
                        setResultsByKey(nextResults);
                        setFailedTaskKeys(nextFailedTaskKeys);
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

                    if (!failedTaskKeysRef.current.has(task.cacheKey)) {
                        const next = new Set(failedTaskKeysRef.current);
                        next.add(task.cacheKey);
                        failedTaskKeysRef.current = next;
                        setFailedTaskKeys(next);
                    }
                    remainingTaskCount -= 1;
                    if (remainingTaskCount === 0) {
                        setIsPending(false);
                    }
                });
        }

        return () => {
            controller.abort();
        };
    }, [options.priority, retryGeneration, taskKeys, taskSignature, tasks]);

    const results = useMemo(
        () => taskKeys.map((key) => resultsByKey[key] ?? null),
        [resultsByKey, taskKeys],
    );

    return {
        failedTaskKeys: taskKeys.filter((key) => failedTaskKeys.has(key)),
        isPending,
        releaseSettledResults,
        results,
        retryFailed,
    };
}

export function getGeneratedLSystemTaskSchedulerSnapshot() {
    return generatedLSystemTaskScheduler.snapshot();
}

export function getGeneratedPackedPlantRenderTaskSchedulerSnapshot() {
    return generatedPackedPlantRenderTaskScheduler.snapshot();
}
