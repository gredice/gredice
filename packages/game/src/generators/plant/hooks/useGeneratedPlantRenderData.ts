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
    recordGeneratedPlantProfileGenerationCancellation,
    recordGeneratedPlantProfileGenerationCompletion,
    recordGeneratedPlantProfileGenerationRequest,
    recordGeneratedPlantProfileGenerationSyncFallback,
    recordGeneratedPlantProfilePackedWorkerResult,
    recordGeneratedPlantProfileSchedulerSnapshot,
    recordGeneratedPlantProfileTemplateCacheSnapshot,
} from '../../../scene/generatedPlantProfileMetrics';
import { useSceneRuntimeVisible } from '../../../scene/SceneTime';
import {
    buildGeneratedPlantRenderData,
    generatePlantTopology,
} from '../lib/generatedPlantRenderData';
import {
    mergePackedPlantRenderDataInstances,
    type PackedPlantRenderData,
    packPlantRenderData,
} from '../lib/packedPlantRenderData';
import {
    PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
    PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND,
    type PackedPlantRenderWorkerRequest,
    type PackedPlantRenderWorkerResponse,
    type PackedPlantRenderWorkerTask,
    type PackedPlantRenderWorkerTemplateCacheMetrics,
} from '../lib/plant-render-worker-types';
import {
    type GeneratedPlantTaskPriority,
    GeneratedPlantTaskScheduler,
} from './generatedPlantTaskScheduler';
import {
    generatedPlantTemplateCacheMaxEntryCount,
    generatedPlantTemplateCacheMaxEstimatedBytes,
} from './generatedPlantTemplateCache';
import {
    type PackedPlantWorkerExecutionResult,
    runPackedPlantWorkerWithRetry,
} from './packedPlantWorkerRetry';

const pendingRequests = new Map<
    number,
    {
        expectedResultCount: number;
        reject: (reason?: unknown) => void;
        resolve: (response: PackedPlantRenderWorkerResponse) => void;
    }
>();

let requestCounter = 0;
let workerInstance: Worker | null = null;

class PlantRenderWorkerRuntimeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PlantRenderWorkerRuntimeError';
    }
}

class PlantRenderWorkerProtocolError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PlantRenderWorkerProtocolError';
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
        isNonNegativeFiniteNumber(value.timings.topologyGenerationDurationMs) &&
        isNonNegativeFiniteNumber(value.timings.totalDurationMs) &&
        isRecord(templateCache) &&
        isTemplateCacheDelta(templateCache.delta) &&
        isTemplateCacheSnapshot(templateCache.snapshot)
    );
}

function isWorkerRuntimeError(error: unknown) {
    return error instanceof PlantRenderWorkerRuntimeError;
}

function generatePackedPlantRenderDataSync(task: PackedPlantRenderWorkerTask) {
    const topology = generatePlantTopology({
        generation: task.generation,
        plantDefinition: task.plantDefinition,
        seed: task.seed,
    });
    const template = packPlantRenderData(
        buildGeneratedPlantRenderData({
            flowerGrowth: task.flowerGrowth,
            fruitGrowth: task.fruitGrowth,
            plantDefinition: task.plantDefinition,
            renderDetailedGeometry: true,
            showFlowers: task.showFlowers,
            showLeaves: task.showLeaves,
            showProduce: task.showProduce,
            topology,
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
            new URL('../workers/plant-render.worker.ts', import.meta.url),
            { type: 'module' },
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
            if (pendingRequests.size > 0) {
                resetWorker(
                    new PlantRenderWorkerProtocolError(
                        'Plant worker response has no valid request id',
                    ),
                    worker,
                );
            }
            return;
        }

        const pending = pendingRequests.get(responseId);
        if (!pending) {
            return;
        }
        if (
            !isPackedPlantRenderWorkerResponse(response) ||
            response.results.length !== pending.expectedResultCount
        ) {
            resetWorker(
                new PlantRenderWorkerProtocolError(
                    `Plant worker response ${responseId} did not match its request`,
                ),
                worker,
            );
            return;
        }

        pendingRequests.delete(responseId);
        pending.resolve(response);
    };
    worker.onerror = (event) => {
        const message =
            typeof event.message === 'string' && event.message.length > 0
                ? event.message
                : 'Plant render worker failed at runtime';
        resetWorker(new PlantRenderWorkerRuntimeError(message), worker);
    };
    worker.onmessageerror = () => {
        resetWorker(
            new PlantRenderWorkerRuntimeError(
                'Plant render worker response could not be deserialized',
            ),
            worker,
        );
    };

    return worker;
}

function getEmptyTemplateCacheMetrics(): PackedPlantRenderWorkerTemplateCacheMetrics {
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

async function runWorkerTasks(
    tasks: PackedPlantRenderWorkerTask[],
    {
        allowSyncFallback = true,
        onWorkerAttemptStarted = () => {},
        signal,
    }: {
        allowSyncFallback?: boolean;
        onWorkerAttemptStarted?: () => void;
        signal?: AbortSignal;
    } = {},
): Promise<PackedPlantWorkerExecutionResult<PackedPlantRenderWorkerResponse>> {
    if (signal?.aborted) {
        throw signal.reason;
    }
    const worker = getWorker();
    if (!worker) {
        if (!allowSyncFallback) {
            throw new PlantRenderWorkerRuntimeError(
                'Plant render worker was unavailable after restart',
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
                    topologyGenerationDurationMs: 0,
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
            const removeAbortListener = () => {
                signal?.removeEventListener('abort', handleAbort);
            };
            const rejectRequest = (reason?: unknown) => {
                removeAbortListener();
                reject(reason);
            };
            const resolveRequest = (
                result: PackedPlantRenderWorkerResponse,
            ) => {
                removeAbortListener();
                resolve(result);
            };
            const handleAbort = () => {
                resetWorker(signal?.reason, worker);
            };
            pendingRequests.set(requestId, {
                expectedResultCount: tasks.length,
                reject: rejectRequest,
                resolve: resolveRequest,
            });
            signal?.addEventListener('abort', handleAbort, { once: true });
            if (signal?.aborted) {
                handleAbort();
                return;
            }
            try {
                onWorkerAttemptStarted();
                worker.postMessage(request);
            } catch (error) {
                pendingRequests.delete(requestId);
                rejectRequest(error);
            }
        },
    );

    return { executionKind: 'worker', response };
}

let templateCacheProfileSessionId: number | null = null;
let templateCacheProfileCounters:
    | PackedPlantRenderWorkerTemplateCacheMetrics['delta']
    | null = null;
let templateCacheProfilePeakEstimatedBytes = 0;

function recordWorkerTemplateCacheProfile(
    metrics: PackedPlantRenderWorkerTemplateCacheMetrics,
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

interface ScheduledPlantRenderWorkerTask {
    profileSessionId: number | null;
    workerTask: PackedPlantRenderWorkerTask;
}

const generatedPackedPlantRenderTaskScheduler = new GeneratedPlantTaskScheduler<
    ScheduledPlantRenderWorkerTask,
    PackedPlantRenderData
>(async ({ profileSessionId: sessionId, workerTask }, context) => {
    const { executionKind, response, workerDurationMs } =
        await runPackedPlantWorkerWithRetry({
            execute: ({ allowSyncFallback, onWorkerAttemptStarted }) =>
                runWorkerTasks([workerTask], {
                    allowSyncFallback,
                    onWorkerAttemptStarted,
                    signal: context.signal,
                }),
            isRuntimeError: isWorkerRuntimeError,
            onWorkerAttemptFailed:
                sessionId === null
                    ? undefined
                    : (durationMs) => {
                          recordGeneratedPlantProfileGenerationCompletion({
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
                          recordGeneratedPlantProfileGenerationRequest({
                              requestedTaskCount: 0,
                              sessionId,
                              workerTaskCount: 1,
                          });
                      },
        });
    if (executionKind === 'sync-fallback' && sessionId !== null) {
        recordGeneratedPlantProfileGenerationSyncFallback(1, sessionId);
    }

    const [result] = response.results;
    if (!result) {
        throw new Error('Plant render worker returned no task result');
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
        recordGeneratedPlantProfileGenerationCompletion({
            completedTaskCount: 0,
            durationMs: workerDurationMs ?? response.timings.totalDurationMs,
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
    workerTask: PackedPlantRenderWorkerTask;
}

interface RequestGeneratedPlantRenderDataOptions {
    priority?: GeneratedPlantTaskPriority;
    signal?: AbortSignal;
}

function recordSchedulerSnapshot(sessionId: number | null) {
    if (
        sessionId !== null &&
        getGeneratedPlantProfileSessionId() === sessionId
    ) {
        recordGeneratedPlantProfileSchedulerSnapshot(
            generatedPackedPlantRenderTaskScheduler.snapshot(),
            sessionId,
        );
    }
}

async function requestGeneratedPackedPlantRenderData(
    { cacheKey, templateKey, workerTask }: GeneratedPackedPlantRenderTask,
    options: RequestGeneratedPlantRenderDataOptions = {},
) {
    const sessionId = getGeneratedPlantProfileSessionId();
    if (sessionId !== null) {
        recordGeneratedPlantProfileGenerationRequest({
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
            workerTask: { ...workerTask, templateKey },
        },
    });
    recordSchedulerSnapshot(sessionId);

    try {
        const result = await scheduled;
        if (sessionId !== null) {
            recordGeneratedPlantProfileGenerationCompletion({
                completedTaskCount: 1,
                durationMs: 0,
                sessionId,
            });
        }
        return result;
    } catch (error) {
        if (isAbortError(error) && sessionId !== null) {
            recordGeneratedPlantProfileGenerationCancellation(1, sessionId);
        }
        throw error;
    } finally {
        recordSchedulerSnapshot(sessionId);
    }
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
    options: Pick<RequestGeneratedPlantRenderDataOptions, 'priority'> = {},
) {
    const runtimeVisible = useSceneRuntimeVisible();
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
        if (!runtimeVisible) {
            setIsPending(true);
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
        startTransition(() => setResultsByKey(retainedResults));

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
                        { [task.cacheKey]: result },
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

        return () => controller.abort();
    }, [
        options.priority,
        retryGeneration,
        runtimeVisible,
        taskKeys,
        taskSignature,
        tasks,
    ]);

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

export function getGeneratedPackedPlantRenderTaskSchedulerSnapshot() {
    return generatedPackedPlantRenderTaskScheduler.snapshot();
}
