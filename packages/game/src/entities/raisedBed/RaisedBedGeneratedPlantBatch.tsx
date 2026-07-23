'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeneratedLSystemTaskPriority } from '../../generators/plant/hooks/generatedLSystemTaskScheduler';
import {
    type GeneratedPackedPlantRenderTask,
    useGeneratedPackedPlantRenderDataBatch,
} from '../../generators/plant/hooks/useGeneratedLSystem';
import { buildGeneratedPlantLodTasks } from '../../generators/plant/lib/generatedPlantLodTasks';
import {
    getGeneratedPlantInstanceVariation,
    getGeneratedPlantTemplateKey,
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
import type { PlantLodLevel } from '../../generators/plant/lib/plantLod';
import { buildApproximatePlantLodSummary } from '../../generators/plant/lib/plantLodSummary';
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
import { RaisedBedPlantShadowProxy } from './RaisedBedPlantShadowProxy';

export interface RaisedBedGeneratedPlantBatchInstance {
    fieldKey?: string;
    generation: number;
    position: readonly [number, number, number];
    raisedBedId?: number;
    scale: number;
    seed: string;
}

interface RaisedBedGeneratedPlantBatchProps {
    definition: PlantDefinition;
    flowerGrowth?: number;
    fruitGrowth?: number;
    instances: RaisedBedGeneratedPlantBatchInstance[];
    lodLevel?: PlantLodLevel;
    showProduce?: boolean;
    taskPriority?: GeneratedLSystemTaskPriority;
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
}: {
    batchedData: PackedPlantRenderData;
    definition: PlantDefinition;
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
        recordGeneratedPlantProfilePostSwapCompilation({
            compilationCount:
                !prewarmReady ||
                programCount === null ||
                prewarmProgramCount === null
                    ? null
                    : Math.max(0, programCount - prewarmProgramCount),
            prewarmReady,
            programCount,
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
                debugName={`RaisedBedPlantLeaves:${definition.name}:count:${batchedData.leaves.count}`}
            />
            {definition.flower.enabled && (
                <Flowers
                    bounds={batchedData.bounds}
                    seed={swaySeed}
                    packed={batchedData.flowers}
                    color={definition.flower.color}
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
    lodLevel = 'near',
    showProduce = true,
    taskPriority = 'normal',
}: RaisedBedGeneratedPlantBatchProps) {
    const renderDetailedGeometry = lodLevel === 'near';
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
                    showProduce,
                }),
            })),
        [
            definition,
            flowerGrowth,
            fruitGrowth,
            instances,
            instanceVariations,
            showProduce,
        ],
    );
    const generationTasks = useMemo(
        () => buildGeneratedPlantLodTasks(definition, instances, lodLevel),
        [definition, instances, lodLevel],
    );
    const renderChunks = useMemo<GeneratedPackedPlantRenderChunk[]>(() => {
        const chunks = new Map<string, GeneratedPackedPlantRenderChunk>();

        generationTasks.forEach((generationTask, index) => {
            const instance = instances[index];
            if (!instance) {
                return;
            }

            const generation = Math.min(
                MAX_PLANT_GENERATION,
                Math.max(0, instance.generation),
            );
            const variant = resolveGeneratedPlantTemplateVariant(instance.seed);
            const templateKey = getGeneratedPlantTemplateKey({
                definition,
                flowerGrowth,
                fruitGrowth,
                generation,
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
                yawRadians: variation?.yawRadians,
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
                    generationTask,
                    plantDefinition: definition,
                    rootTransforms: [rootTransform],
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
        generationTasks,
        instances,
        instanceVariations,
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
                if (!profileActive || !instance?.fieldKey) {
                    continue;
                }

                const current = partsByField.get(instance.fieldKey) ?? {
                    billboardInstances: 0,
                    flowers: 0,
                    leaves: 0,
                    produce: 0,
                    shadowCasterSubmissions: 0,
                    shadowPrimitiveInstances: 0,
                    stems: 0,
                    thorns: 0,
                };
                current.stems += stemCount;
                current.leaves += leafCount;
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
        instances,
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
    useEffect(() => {
        if (taskPriority !== 'focused' || failedTaskKeys.length === 0) {
            return;
        }

        const failureSignature = `${renderChunkSignature}:${failedTaskKeys.join('|')}`;
        if (autoRetriedFailureSignatureRef.current === failureSignature) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            autoRetriedFailureSignatureRef.current = failureSignature;
            retryFailed();
        }, 1_000);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [failedTaskKeys, renderChunkSignature, retryFailed, taskPriority]);
    const profileBatchId = `${batchSeed}:${lodLevel}`;
    useEffect(() => {
        const sessionId = getGeneratedPlantProfileSessionId();
        if (sessionId === null || profileFields.length === 0) {
            return;
        }

        const status =
            lodLevel !== 'near'
                ? 'billboard'
                : batchedData && pendingBillboards.length === 0
                  ? 'detailed'
                  : 'pending-near';
        recordGeneratedPlantProfileBatch(
            profileBatchId,
            {
                activeArchetypeCount: renderChunks.length,
                failedArchetypeCount: failedTaskKeys.length,
                fields: profileFields.map((field) => ({
                    ...field,
                    parts: batchBuild.partsByField.get(field.fieldKey),
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
            />
            <RaisedBedPlantShadowProxy
                key="plant-shadow-proxy"
                plants={shadowPlants}
            />
        </group>
    );
}
