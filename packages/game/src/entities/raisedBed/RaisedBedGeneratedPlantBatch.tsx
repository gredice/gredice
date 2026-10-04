'use client';

import { useThree } from '@react-three/fiber';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import type { GeneratedPlantTaskPriority } from '../../generators/plant/hooks/generatedPlantTaskScheduler';
import {
    type GeneratedPackedPlantRenderTask,
    useGeneratedPackedPlantRenderDataBatch,
} from '../../generators/plant/hooks/useGeneratedPlantRenderData';
import {
    getGeneratedPlantInstanceVariation,
    getGeneratedPlantTemplateKey,
    getGeneratedPlantTemplateSeed,
    resolveGeneratedPlantTemplateVariant,
} from '../../generators/plant/lib/generatedPlantTemplates';
import {
    mergePackedPlantRenderDataBatches,
    type PackedPlantRenderData,
} from '../../generators/plant/lib/packedPlantRenderData';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from '../../generators/plant/lib/plant-definitions';
import {
    getPlantLeafGeometryTriangleCount,
    type PlantLeafGeometryDetail,
} from '../../generators/plant/lib/plantLeafGeometry';
import type { PlantLodLevel } from '../../generators/plant/lib/plantLod';
import { buildApproximatePlantLodSummary } from '../../generators/plant/lib/plantLodSummary';
import { getPlantBillboardPrimitiveTriangleCount } from '../../generators/plant/lib/plantMidBillboardMaterial';
import {
    getGeneratedPlantShaderPrewarmLifecycleStatus,
    getGeneratedPlantShaderProgramDiagnostics,
    shouldRenderGeneratedPlantDetailAfterPrewarm,
    subscribeToGeneratedPlantShaderPrewarmLifecycle,
} from '../../generators/plant/lib/plantShaderPrewarm';
import { Flowers } from '../../generators/plant/parts/flowers';
import { Leaves } from '../../generators/plant/parts/leaves';
import { PlantBillboardBatch } from '../../generators/plant/parts/PlantBillboard';
import { Stems } from '../../generators/plant/parts/stems';
import { Thorns } from '../../generators/plant/parts/thorns';
import { Vegetables } from '../../generators/plant/parts/vegetables';
import type { GeneratedPlantProfilePartCounts } from '../../scene/gameProfileMetadata';
import {
    getGeneratedPlantProfileSessionId,
    getGeneratedPlantProfileSnapshot,
    isGeneratedPlantProfileActive,
    recordGeneratedPlantProfileBatch,
    recordGeneratedPlantProfileBuild,
    recordGeneratedPlantProfilePostSwapCompilation,
    removeGeneratedPlantProfileBatch,
} from '../../scene/generatedPlantProfileMetrics';
import { registerGeneratedPlantRenderBatch } from '../../scene/generatedPlantRenderRegistry';
import { useSceneDeadline } from '../../scene/SceneTime';
import { RaisedBedPlantShadowProxy } from './RaisedBedPlantShadowProxy';

export interface RaisedBedGeneratedPlantBatchInstance {
    fieldKey?: string;
    generation: number;
    position: readonly [number, number, number];
    raisedBedId?: number;
    scale: number;
    seed: string;
    yawRadians?: number;
}

interface RaisedBedGeneratedPlantBatchProps {
    definition: PlantDefinition;
    flowerGrowth?: number;
    fruitGrowth?: number;
    instances: RaisedBedGeneratedPlantBatchInstance[];
    leafGeometryDetail?: PlantLeafGeometryDetail;
    lodLevel?: PlantLodLevel;
    showFlowers?: boolean;
    showProduce?: boolean;
    shaderPrewarmVariantKey?: string;
    taskPriority?: GeneratedPlantTaskPriority;
}

type DetailedBatchBuildResult = {
    data: PackedPlantRenderData | null;
    durationMs: number;
    partsByField: Map<string, GeneratedPlantProfilePartCounts>;
    resolvedChunks: Array<{
        data: PackedPlantRenderData;
        key: string;
    }>;
    resolvedInstanceCount: number;
};

type SettledDetailedBatch = {
    data: PackedPlantRenderData;
    durationMs: number;
    partsByField: Map<string, GeneratedPlantProfilePartCounts>;
    resolvedInstanceCount: number;
    signature: string;
};

type GeneratedPackedPlantRenderChunk = GeneratedPackedPlantRenderTask & {
    instanceIndexes: number[];
    templateKey: string;
};

function RaisedBedDetailedPlantBatch({
    batchedData,
    definition,
    leafGeometryDetail,
}: {
    batchedData: PackedPlantRenderData;
    definition: PlantDefinition;
    leafGeometryDetail: PlantLeafGeometryDetail;
}) {
    const gl = useThree((state) => state.gl);
    const swaySeed = `raised-bed:${definition.name}:near`;

    useEffect(() => {
        const sessionId = getGeneratedPlantProfileSessionId();
        if (sessionId === null) {
            return;
        }

        const programCount = gl.info.programs?.length ?? null;
        const shaderPrewarm =
            getGeneratedPlantProfileSnapshot()?.pipeline.shaderPrewarm;
        const prewarmProgramCount = shaderPrewarm?.programCountAfter ?? null;
        const prewarmReady = shaderPrewarm?.status === 'ready';
        const programs = getGeneratedPlantShaderProgramDiagnostics(
            gl.info.programs,
        );
        const prewarmProgramIds = new Set(
            shaderPrewarm?.programsAfter?.map((program) => program.id) ?? [],
        );
        const postSwapPrograms =
            programs?.filter((program) => !prewarmProgramIds.has(program.id)) ??
            null;
        recordGeneratedPlantProfilePostSwapCompilation({
            compilationCount:
                !prewarmReady ||
                programCount === null ||
                prewarmProgramCount === null ||
                postSwapPrograms === null
                    ? null
                    : postSwapPrograms.length,
            prewarmReady,
            programCount,
            programs: postSwapPrograms,
            sessionId,
        });
    }, [gl]);

    return (
        <group name={`RaisedBedPlantBatch:${definition.name}:near`}>
            <Stems
                bounds={batchedData.bounds}
                seed={swaySeed}
                packed={batchedData.stems}
                stem={definition.stem}
                castShadow={false}
                debugName={`RaisedBedPlantStems:${definition.name}:segments:${batchedData.stems.count}`}
            />
            <Leaves
                bounds={batchedData.bounds}
                seed={swaySeed}
                packed={batchedData.leaves}
                type={definition.leaf.type}
                castShadow={false}
                geometryDetail={leafGeometryDetail}
                debugName={`RaisedBedPlantLeaves:${definition.name}:${leafGeometryDetail}:count:${batchedData.leaves.count}`}
            />
            {definition.flower.enabled && (
                <Flowers
                    bounds={batchedData.bounds}
                    seed={swaySeed}
                    packed={batchedData.flowers}
                    color={definition.flower.color}
                    form={definition.development.reproduction.form}
                    castShadow={false}
                />
            )}
            {definition.vegetable.enabled && (
                <Vegetables
                    bounds={batchedData.bounds}
                    seed={swaySeed}
                    packed={batchedData.vegetables}
                    castShadow={false}
                />
            )}
            {definition.thorn?.enabled && (
                <Thorns
                    bounds={batchedData.bounds}
                    seed={swaySeed}
                    packed={batchedData.thorns}
                    color={definition.thorn.color}
                    castShadow={false}
                />
            )}
        </group>
    );
}

export function RaisedBedGeneratedPlantBatch({
    definition,
    flowerGrowth = 1,
    fruitGrowth = 1,
    instances,
    leafGeometryDetail = 'full',
    lodLevel = 'near',
    showFlowers = true,
    showProduce = true,
    shaderPrewarmVariantKey = 'shadows',
    taskPriority = 'normal',
}: RaisedBedGeneratedPlantBatchProps) {
    const gl = useThree((state) => state.gl);
    const renderDetailedGeometry = lodLevel === 'near';
    const prewarmRequired =
        renderDetailedGeometry && taskPriority === 'focused';
    const subscribeToPrewarm = useCallback(
        (listener: () => void) =>
            subscribeToGeneratedPlantShaderPrewarmLifecycle({
                listener,
                renderer: gl,
                variantKey: shaderPrewarmVariantKey,
            }),
        [gl, shaderPrewarmVariantKey],
    );
    const getPrewarmSnapshot = useCallback(
        () =>
            getGeneratedPlantShaderPrewarmLifecycleStatus({
                renderer: gl,
                variantKey: shaderPrewarmVariantKey,
            }),
        [gl, shaderPrewarmVariantKey],
    );
    const prewarmStatus = useSyncExternalStore(
        subscribeToPrewarm,
        getPrewarmSnapshot,
        getPrewarmSnapshot,
    );
    const canRenderDetailedGeometry =
        renderDetailedGeometry &&
        shouldRenderGeneratedPlantDetailAfterPrewarm({
            required: prewarmRequired,
            status: prewarmStatus,
        });
    const batchSeed = useMemo(() => {
        if (!renderDetailedGeometry) {
            return definition.name;
        }

        return `${definition.name}:${instances.map((instance) => instance.seed).join('|')}`;
    }, [definition.name, instances, renderDetailedGeometry]);
    const instanceVariations = useMemo(
        () =>
            instances.map((instance) =>
                getGeneratedPlantInstanceVariation(instance.seed),
            ),
        [instances],
    );
    const billboards = useMemo(
        () =>
            instances.map((instance, index) => ({
                position: instance.position,
                scale:
                    instance.scale *
                    (instanceVariations[index]?.scaleMultiplier ?? 1),
                seed: instance.seed,
                summary: buildApproximatePlantLodSummary({
                    flowerGrowth,
                    fruitGrowth,
                    generation: instance.generation,
                    plantDefinition: definition,
                    seed: instance.seed,
                    showFlowers,
                    showProduce,
                }),
            })),
        [
            definition,
            flowerGrowth,
            fruitGrowth,
            instances,
            instanceVariations,
            showFlowers,
            showProduce,
        ],
    );
    const renderChunks = useMemo<GeneratedPackedPlantRenderChunk[]>(() => {
        if (!renderDetailedGeometry) {
            return [];
        }

        const chunks = new Map<string, GeneratedPackedPlantRenderChunk>();

        instances.forEach((instance, index) => {
            const generation = Math.min(
                MAX_PLANT_GENERATION,
                Math.max(0, instance.generation),
            );
            const variant = resolveGeneratedPlantTemplateVariant(instance.seed);
            const seed = getGeneratedPlantTemplateSeed({
                definition,
                variant,
            });
            const templateKey = getGeneratedPlantTemplateKey({
                definition,
                flowerGrowth,
                fruitGrowth,
                generation,
                showFlowers,
                showProduce,
                variant,
            });
            const variation = instanceVariations[index];
            const rootTransform = {
                leafColorMultiplier: variation?.leafColorMultiplier,
                swayPhaseRadians: variation?.swayPhaseRadians,
                translation: instance.position,
                uniformScale:
                    instance.scale * (variation?.scaleMultiplier ?? 1),
                yawRadians: instance.yawRadians ?? variation?.yawRadians,
            };
            const chunk = chunks.get(templateKey);
            if (chunk) {
                chunk.instanceIndexes.push(index);
                chunk.workerTask.rootTransforms?.push(rootTransform);
                return;
            }

            chunks.set(templateKey, {
                cacheKey: templateKey,
                instanceIndexes: [index],
                templateKey,
                workerTask: {
                    flowerGrowth,
                    fruitGrowth,
                    generation,
                    plantDefinition: definition,
                    rootTransforms: [rootTransform],
                    seed,
                    showFlowers,
                    showProduce,
                    templateKey,
                },
            });
        });

        return Array.from(chunks.values(), (chunk) => ({
            ...chunk,
            cacheKey: JSON.stringify([
                chunk.templateKey,
                chunk.workerTask.rootTransforms,
            ]),
        }));
    }, [
        definition,
        flowerGrowth,
        fruitGrowth,
        instances,
        instanceVariations,
        renderDetailedGeometry,
        showFlowers,
        showProduce,
    ]);
    const renderChunkSignature = useMemo(
        () => JSON.stringify(renderChunks.map((chunk) => chunk.cacheKey)),
        [renderChunks],
    );
    const [settledBatch, setSettledBatch] =
        useState<SettledDetailedBatch | null>(null);
    const autoRetriedFailureSignatureRef = useRef<string | null>(null);
    useEffect(() => {
        setSettledBatch((current) =>
            current?.signature === renderChunkSignature ? current : null,
        );
    }, [renderChunkSignature]);
    const {
        failedTaskKeys,
        releaseSettledResults,
        results: packedChunks,
        retryFailed,
    } = useGeneratedPackedPlantRenderDataBatch(renderChunks, {
        priority: taskPriority,
    });
    const resolvedInstanceIndexes = useMemo(() => {
        if (!canRenderDetailedGeometry) {
            return new Set<number>();
        }
        if (settledBatch?.signature === renderChunkSignature) {
            return new Set(instances.map((_instance, index) => index));
        }

        const resolved = new Set<number>();
        packedChunks.forEach((packedChunk, chunkIndex) => {
            if (!packedChunk) {
                return;
            }

            renderChunks[chunkIndex]?.instanceIndexes.forEach((index) => {
                resolved.add(index);
            });
        });
        return resolved;
    }, [
        canRenderDetailedGeometry,
        instances,
        packedChunks,
        renderChunks,
        renderChunkSignature,
        settledBatch,
    ]);
    const pendingBillboards = useMemo(
        () =>
            billboards.filter(
                (_billboard, index) => !resolvedInstanceIndexes.has(index),
            ),
        [billboards, resolvedInstanceIndexes],
    );
    const shadowPlants = useMemo(
        () =>
            billboards.map(({ position, scale, summary }) => ({
                canopyWidth: summary.canopyWidth,
                height: summary.height,
                position,
                scale,
                stemWidth: summary.stemWidth,
            })),
        [billboards],
    );
    const profileFields = useMemo(() => {
        const fields = new Map<
            string,
            {
                fieldKey: string;
                billboardInstanceCount: number;
                instanceCount: number;
                raisedBedId: number;
                resolvedInstanceCount: number;
            }
        >();
        instances.forEach((instance, index) => {
            if (
                instance.fieldKey === undefined ||
                instance.raisedBedId === undefined
            ) {
                return;
            }

            const current = fields.get(instance.fieldKey);
            if (current) {
                current.instanceCount += 1;
                if (resolvedInstanceIndexes.has(index)) {
                    current.resolvedInstanceCount += 1;
                } else {
                    current.billboardInstanceCount += 1;
                }
            } else {
                fields.set(instance.fieldKey, {
                    billboardInstanceCount: resolvedInstanceIndexes.has(index)
                        ? 0
                        : 1,
                    fieldKey: instance.fieldKey,
                    instanceCount: 1,
                    raisedBedId: instance.raisedBedId,
                    resolvedInstanceCount: resolvedInstanceIndexes.has(index)
                        ? 1
                        : 0,
                });
            }
        });
        return Array.from(fields.values());
    }, [instances, resolvedInstanceIndexes]);
    const batchBuild = useMemo<DetailedBatchBuildResult>(() => {
        if (settledBatch?.signature === renderChunkSignature) {
            return {
                data: settledBatch.data,
                durationMs: settledBatch.durationMs,
                partsByField: settledBatch.partsByField,
                resolvedChunks: [],
                resolvedInstanceCount: settledBatch.resolvedInstanceCount,
            };
        }

        if (!renderDetailedGeometry) {
            return {
                data: null,
                durationMs: 0,
                partsByField: new Map(),
                resolvedChunks: [],
                resolvedInstanceCount: 0,
            };
        }

        const profileActive = isGeneratedPlantProfileActive();
        const resolvedChunks: DetailedBatchBuildResult['resolvedChunks'] = [];
        const partsByField = new Map<string, GeneratedPlantProfilePartCounts>();
        let shadowSubmissionRecorded = false;
        let detailedInstanceCount = 0;
        packedChunks.forEach((packedChunk, chunkIndex) => {
            if (!packedChunk) {
                return;
            }

            const instanceIndexes =
                renderChunks[chunkIndex]?.instanceIndexes ?? [];
            if (instanceIndexes.length === 0) {
                return;
            }

            resolvedChunks.push({
                data: packedChunk,
                key:
                    renderChunks[chunkIndex]?.cacheKey ??
                    `resolved-chunk:${chunkIndex.toString()}`,
            });
            detailedInstanceCount += instanceIndexes.length;
            const stemCount = packedChunk.stems.count / instanceIndexes.length;
            const leafCount = packedChunk.leaves.count / instanceIndexes.length;
            const leafTriangleCount =
                leafCount *
                getPlantLeafGeometryTriangleCount(
                    definition.leaf.type,
                    leafGeometryDetail,
                );
            const flowerCount =
                packedChunk.flowers.count / instanceIndexes.length;
            const produceCount =
                packedChunk.vegetables.reduce(
                    (total, vegetable) => total + vegetable.count,
                    0,
                ) / instanceIndexes.length;
            const thornCount =
                packedChunk.thorns.count / instanceIndexes.length;

            for (const index of instanceIndexes) {
                const instance = instances[index];
                if (!instance?.fieldKey) {
                    continue;
                }

                const current = partsByField.get(instance.fieldKey) ?? {
                    billboardInstances: 0,
                    compactLeafInstances: 0,
                    flowers: 0,
                    leafTriangles: 0,
                    leaves: 0,
                    produce: 0,
                    shadowCasterSubmissions: 0,
                    shadowPrimitiveInstances: 0,
                    stems: 0,
                    thorns: 0,
                };
                current.stems += stemCount;
                current.leaves += leafCount;
                current.compactLeafInstances +=
                    leafGeometryDetail === 'compact' ? leafCount : 0;
                current.leafTriangles += leafTriangleCount;
                current.flowers += flowerCount;
                current.produce += produceCount;
                current.thorns += thornCount;
                current.shadowPrimitiveInstances += 1;
                if (!shadowSubmissionRecorded) {
                    current.shadowCasterSubmissions += 1;
                    shadowSubmissionRecorded = true;
                }
                partsByField.set(instance.fieldKey, current);
            }
        });
        const fullyResolved =
            instances.length > 0 &&
            resolvedChunks.length > 0 &&
            detailedInstanceCount === instances.length &&
            resolvedChunks.length === renderChunks.length;
        const startedAt =
            profileActive && fullyResolved ? performance.now() : 0;
        const data = fullyResolved
            ? mergePackedPlantRenderDataBatches(
                  resolvedChunks.map((chunk) => chunk.data),
              )
            : null;

        return {
            data,
            durationMs:
                profileActive && fullyResolved
                    ? performance.now() - startedAt
                    : 0,
            partsByField,
            resolvedChunks,
            resolvedInstanceCount: detailedInstanceCount,
        };
    }, [
        definition.leaf.type,
        instances,
        leafGeometryDetail,
        packedChunks,
        renderChunks,
        renderChunkSignature,
        renderDetailedGeometry,
        settledBatch,
    ]);
    const batchedData = batchBuild.data;
    useEffect(() => {
        if (
            !batchBuild.data ||
            settledBatch?.signature === renderChunkSignature
        ) {
            return;
        }

        setSettledBatch({
            data: batchBuild.data,
            durationMs: batchBuild.durationMs,
            partsByField: batchBuild.partsByField,
            resolvedInstanceCount: batchBuild.resolvedInstanceCount,
            signature: renderChunkSignature,
        });
        releaseSettledResults();
    }, [
        batchBuild.data,
        batchBuild.durationMs,
        batchBuild.partsByField,
        batchBuild.resolvedInstanceCount,
        releaseSettledResults,
        renderChunkSignature,
        settledBatch,
    ]);
    const failedTaskSignature =
        failedTaskKeys.length === 0
            ? null
            : `${renderChunkSignature}:${failedTaskKeys.join('|')}`;
    const autoRetryDeadlineMs = useMemo(() => {
        if (
            taskPriority !== 'focused' ||
            failedTaskSignature === null ||
            autoRetriedFailureSignatureRef.current === failedTaskSignature
        ) {
            return null;
        }
        return globalThis.performance.now() + 1_000;
    }, [failedTaskSignature, taskPriority]);
    useSceneDeadline({
        callback: () => {
            if (failedTaskSignature === null) {
                return;
            }
            autoRetriedFailureSignatureRef.current = failedTaskSignature;
            retryFailed();
        },
        deadlineMs: autoRetryDeadlineMs,
        owner: `generated-plant-retry:${batchSeed}`,
    });
    const profileBatchId = `${batchSeed}:${lodLevel}`;
    const detailedLeafTriangleCount = useMemo(
        () =>
            canRenderDetailedGeometry
                ? Array.from(batchBuild.partsByField.values()).reduce(
                      (total, parts) => total + parts.leafTriangles,
                      0,
                  )
                : 0,
        [batchBuild.partsByField, canRenderDetailedGeometry],
    );
    const clusterPrimitiveTriangleCount = useMemo(
        () =>
            getPlantBillboardPrimitiveTriangleCount(
                lodLevel === 'far' ? 'far' : 'mid',
                pendingBillboards.map((billboard) => billboard.summary),
            ),
        [lodLevel, pendingBillboards],
    );
    useEffect(
        () =>
            registerGeneratedPlantRenderBatch(profileBatchId, {
                clusterInstanceCount: pendingBillboards.length,
                clusterPrimitiveTriangleCount,
                detailedInstanceCount: canRenderDetailedGeometry
                    ? batchBuild.resolvedInstanceCount
                    : 0,
                detailedLeafTriangleCount,
                nearInstanceCount: renderDetailedGeometry
                    ? instances.length
                    : 0,
                pendingDetailInstanceCount: renderDetailedGeometry
                    ? Math.max(
                          0,
                          instances.length -
                              (canRenderDetailedGeometry
                                  ? batchBuild.resolvedInstanceCount
                                  : 0),
                      )
                    : 0,
            }),
        [
            batchBuild.resolvedInstanceCount,
            canRenderDetailedGeometry,
            clusterPrimitiveTriangleCount,
            detailedLeafTriangleCount,
            instances.length,
            pendingBillboards.length,
            profileBatchId,
            renderDetailedGeometry,
        ],
    );
    useEffect(() => {
        const sessionId = getGeneratedPlantProfileSessionId();
        if (sessionId === null || profileFields.length === 0) {
            return;
        }

        const status =
            lodLevel !== 'near'
                ? 'billboard'
                : canRenderDetailedGeometry &&
                    batchedData &&
                    pendingBillboards.length === 0
                  ? 'detailed'
                  : 'pending-near';
        recordGeneratedPlantProfileBatch(
            profileBatchId,
            {
                activeArchetypeCount: renderChunks.length,
                failedArchetypeCount: failedTaskKeys.length,
                fields: profileFields.map((field) => ({
                    ...field,
                    parts: canRenderDetailedGeometry
                        ? batchBuild.partsByField.get(field.fieldKey)
                        : undefined,
                })),
                status,
            },
            sessionId,
        );
        if (batchedData) {
            recordGeneratedPlantProfileBuild({
                buildId: `${profileBatchId}:settled:${batchBuild.resolvedInstanceCount.toString()}`,
                durationMs: batchBuild.durationMs,
                instanceCount: batchBuild.resolvedInstanceCount,
                sessionId,
            });
        }

        return () =>
            removeGeneratedPlantProfileBatch(profileBatchId, sessionId);
    }, [
        batchBuild.durationMs,
        batchBuild.partsByField,
        batchBuild.resolvedInstanceCount,
        batchedData,
        canRenderDetailedGeometry,
        failedTaskKeys.length,
        lodLevel,
        profileBatchId,
        profileFields,
        renderChunks.length,
        pendingBillboards.length,
    ]);

    if (lodLevel !== 'near') {
        return (
            <PlantBillboardBatch
                billboards={billboards}
                debugName={`RaisedBedPlantBillboards:${definition.name}`}
                level={lodLevel}
            />
        );
    }

    if (!canRenderDetailedGeometry) {
        return (
            <group
                name={`RaisedBedPlantBatch:${definition.name}:prewarming-near`}
            >
                <PlantBillboardBatch
                    billboards={billboards}
                    debugName={`RaisedBedPlantBillboards:${definition.name}:prewarming-near`}
                    level="mid"
                />
                <RaisedBedPlantShadowProxy
                    key="plant-shadow-proxy"
                    plants={shadowPlants}
                />
            </group>
        );
    }

    if (!batchedData && batchBuild.resolvedChunks.length === 0) {
        return (
            <group name={`RaisedBedPlantBatch:${definition.name}:pending-near`}>
                <PlantBillboardBatch
                    billboards={pendingBillboards}
                    debugName={`RaisedBedPlantBillboards:${definition.name}:pending-near`}
                    level="mid"
                />
                <RaisedBedPlantShadowProxy
                    key="plant-shadow-proxy"
                    plants={shadowPlants}
                />
            </group>
        );
    }

    if (!batchedData) {
        return (
            <group
                name={`RaisedBedPlantBatch:${definition.name}:progressive-near`}
            >
                {batchBuild.resolvedChunks.map((chunk) => (
                    <RaisedBedDetailedPlantBatch
                        key={chunk.key}
                        batchedData={chunk.data}
                        definition={definition}
                        leafGeometryDetail={leafGeometryDetail}
                    />
                ))}
                <PlantBillboardBatch
                    billboards={pendingBillboards}
                    debugName={`RaisedBedPlantBillboards:${definition.name}:progressive-near`}
                    level="mid"
                />
                <RaisedBedPlantShadowProxy
                    key="plant-shadow-proxy"
                    plants={shadowPlants}
                />
            </group>
        );
    }

    return (
        <group name={`RaisedBedPlantBatch:${definition.name}:settled-near`}>
            <RaisedBedDetailedPlantBatch
                batchedData={batchedData}
                definition={definition}
                leafGeometryDetail={leafGeometryDetail}
            />
            <RaisedBedPlantShadowProxy
                key="plant-shadow-proxy"
                plants={shadowPlants}
            />
        </group>
    );
}
