'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { GeneratedLSystemTaskPriority } from '../../generators/plant/hooks/generatedLSystemTaskScheduler';
import { useGeneratedLSystemSymbolsBatch } from '../../generators/plant/hooks/useGeneratedLSystem';
import {
    buildPlantRenderData,
    type PlantStemSegment,
} from '../../generators/plant/lib/buildPlantRenderData';
import { buildGeneratedPlantLodTasks } from '../../generators/plant/lib/generatedPlantLodTasks';
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
    isGeneratedPlantProfileActive,
    recordGeneratedPlantProfileBatch,
    recordGeneratedPlantProfileBuild,
    removeGeneratedPlantProfileBatch,
} from '../../scene/generatedPlantProfileMetrics';

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

const ROOT_QUATERNION = new THREE.Quaternion();

type DetailedBatchedPlantRenderData = {
    flowers: THREE.Matrix4[];
    leafColors: THREE.Color[];
    leaves: THREE.Matrix4[];
    stemSegments: PlantStemSegment[];
    thorns: THREE.Matrix4[];
    vegetables: ReturnType<typeof buildPlantRenderData>['vegetables'];
};

type DetailedBatchBuildResult = {
    data: DetailedBatchedPlantRenderData | null;
    durationMs: number;
    partsByField: Map<string, GeneratedPlantProfilePartCounts>;
};

function RaisedBedDetailedPlantBatch({
    batchSeed,
    batchedData,
    definition,
}: {
    batchSeed: string;
    batchedData: DetailedBatchedPlantRenderData;
    definition: PlantDefinition;
}) {
    return (
        <group name={`RaisedBedPlantBatch:${definition.name}:near`}>
            <Stems
                seed={batchSeed}
                segments={batchedData.stemSegments}
                stem={definition.stem}
                debugName={`RaisedBedPlantStems:${definition.name}:segments:${batchedData.stemSegments.length}`}
            />
            <Leaves
                seed={`${batchSeed}-leaves`}
                matrices={batchedData.leaves}
                colors={batchedData.leafColors}
                type={definition.leaf.type}
                debugName={`RaisedBedPlantLeaves:${definition.name}:count:${batchedData.leaves.length}`}
            />
            {definition.flower.enabled && (
                <Flowers
                    seed={`${batchSeed}-flowers`}
                    matrices={batchedData.flowers}
                    color={definition.flower.color}
                />
            )}
            {definition.vegetable.enabled && (
                <Vegetables
                    seed={`${batchSeed}-vegetables`}
                    vegetables={batchedData.vegetables}
                />
            )}
            {definition.thorn?.enabled && (
                <Thorns
                    seed={`${batchSeed}-thorns`}
                    matrices={batchedData.thorns}
                    color={definition.thorn.color}
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
    const billboards = useMemo(
        () =>
            instances.map((instance) => ({
                position: instance.position,
                scale: instance.scale,
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
        [definition, flowerGrowth, fruitGrowth, instances, showProduce],
    );
    const tasks = useMemo(
        () => buildGeneratedPlantLodTasks(definition, instances, lodLevel),
        [definition, instances, lodLevel],
    );
    const { symbols } = useGeneratedLSystemSymbolsBatch(tasks, {
        priority: taskPriority,
    });
    const pendingBillboards = useMemo(
        () => billboards.filter((_billboard, index) => symbols[index] === null),
        [billboards, symbols],
    );
    const profileFields = useMemo(() => {
        const fields = new Map<
            string,
            {
                fieldKey: string;
                instanceCount: number;
                raisedBedId: number;
            }
        >();
        for (const instance of instances) {
            if (
                instance.fieldKey === undefined ||
                instance.raisedBedId === undefined
            ) {
                continue;
            }

            const current = fields.get(instance.fieldKey);
            if (current) {
                current.instanceCount += 1;
            } else {
                fields.set(instance.fieldKey, {
                    fieldKey: instance.fieldKey,
                    instanceCount: 1,
                    raisedBedId: instance.raisedBedId,
                });
            }
        }
        return Array.from(fields.values());
    }, [instances]);
    const batchBuild = useMemo<DetailedBatchBuildResult>(() => {
        if (!renderDetailedGeometry) {
            return {
                data: null,
                durationMs: 0,
                partsByField: new Map(),
            };
        }

        if (symbols.length !== instances.length) {
            return {
                data: null,
                durationMs: 0,
                partsByField: new Map(),
            };
        }

        const profileActive = isGeneratedPlantProfileActive();
        const startedAt = profileActive ? performance.now() : 0;
        const rootPosition = new THREE.Vector3();
        const rootScale = new THREE.Vector3();
        const rootMatrix = new THREE.Matrix4();
        const stemSegments: PlantStemSegment[] = [];
        const leaves: THREE.Matrix4[] = [];
        const leafColors: THREE.Color[] = [];
        const flowers: THREE.Matrix4[] = [];
        const vegetables: ReturnType<
            typeof buildPlantRenderData
        >['vegetables'] = [];
        const thorns: THREE.Matrix4[] = [];
        const partsByField = new Map<string, GeneratedPlantProfilePartCounts>();
        symbols.forEach((lSystemSymbols, index) => {
            if (!lSystemSymbols) {
                return;
            }

            const instance = instances[index];
            if (!instance) {
                return;
            }
            const clampedGeneration = Math.min(
                MAX_PLANT_GENERATION,
                Math.max(0, instance.generation),
            );
            const plantData = buildPlantRenderData({
                flowerGrowth,
                fruitGrowth,
                generation: clampedGeneration,
                lSystemSymbols,
                plantDefinition: definition,
                renderDetailedGeometry,
                seed: instance.seed,
                showProduce,
            });
            if (profileActive && instance.fieldKey) {
                const stemCount = plantData.stemSegments.length;
                const leafCount = plantData.leaves.length;
                const flowerCount = plantData.flowers.length;
                const produceCount = plantData.vegetables.length;
                const thornCount = plantData.thorns.length;
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
                current.shadowCasterSubmissions += [
                    stemCount,
                    leafCount,
                    flowerCount,
                    produceCount,
                    thornCount,
                ].filter((count) => count > 0).length;
                current.shadowPrimitiveInstances +=
                    stemCount +
                    leafCount +
                    flowerCount +
                    produceCount +
                    thornCount;
                partsByField.set(instance.fieldKey, current);
            }
            rootPosition.set(...instance.position);
            rootScale.setScalar(instance.scale);
            rootMatrix.compose(rootPosition, ROOT_QUATERNION, rootScale);

            plantData.stemSegments.forEach((segment) => {
                stemSegments.push({
                    ...segment,
                    matrix: segment.matrix.clone().premultiply(rootMatrix),
                });
            });
            plantData.leaves.forEach((matrix) => {
                leaves.push(matrix.clone().premultiply(rootMatrix));
            });
            plantData.leafColors.forEach((color) => {
                leafColors.push(color.clone());
            });
            plantData.flowers.forEach((matrix) => {
                flowers.push(matrix.clone().premultiply(rootMatrix));
            });
            plantData.vegetables.forEach((vegetable) => {
                vegetables.push({
                    ...vegetable,
                    matrix: vegetable.matrix.clone().premultiply(rootMatrix),
                });
            });
            plantData.thorns.forEach((matrix) => {
                thorns.push(matrix.clone().premultiply(rootMatrix));
            });
        });
        const detailedInstanceCount = symbols.reduce(
            (count, result) => count + (result === null ? 0 : 1),
            0,
        );
        return {
            data:
                detailedInstanceCount === 0
                    ? null
                    : {
                          flowers,
                          leafColors,
                          leaves,
                          stemSegments,
                          thorns,
                          vegetables,
                      },
            durationMs: profileActive ? performance.now() - startedAt : 0,
            partsByField,
        };
    }, [
        definition,
        flowerGrowth,
        fruitGrowth,
        instances,
        renderDetailedGeometry,
        showProduce,
        symbols,
    ]);
    const batchedData = batchBuild.data;
    const profileBatchId = `${batchSeed}:${lodLevel}`;
    useEffect(() => {
        if (!isGeneratedPlantProfileActive() || profileFields.length === 0) {
            return;
        }

        const status =
            lodLevel !== 'near'
                ? 'billboard'
                : batchedData && pendingBillboards.length === 0
                  ? 'detailed'
                  : 'pending-near';
        recordGeneratedPlantProfileBatch(profileBatchId, {
            fields: profileFields.map((field) => ({
                ...field,
                parts: batchBuild.partsByField.get(field.fieldKey),
            })),
            status,
        });
        if (batchedData && batchBuild.durationMs > 0) {
            recordGeneratedPlantProfileBuild({
                buildId: profileBatchId,
                durationMs: batchBuild.durationMs,
                instanceCount: instances.length,
            });
        }

        return () => removeGeneratedPlantProfileBatch(profileBatchId);
    }, [
        batchBuild.durationMs,
        batchBuild.partsByField,
        batchedData,
        instances.length,
        lodLevel,
        profileBatchId,
        profileFields,
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

    if (!batchedData) {
        return (
            <PlantBillboardBatch
                billboards={pendingBillboards}
                debugName={`RaisedBedPlantBillboards:${definition.name}:pending-near`}
                level="mid"
            />
        );
    }

    if (pendingBillboards.length > 0) {
        return (
            <group
                name={`RaisedBedPlantBatch:${definition.name}:progressive-near`}
            >
                <RaisedBedDetailedPlantBatch
                    batchSeed={batchSeed}
                    batchedData={batchedData}
                    definition={definition}
                />
                <PlantBillboardBatch
                    billboards={pendingBillboards}
                    debugName={`RaisedBedPlantBillboards:${definition.name}:progressive-near`}
                    level="mid"
                />
            </group>
        );
    }

    return (
        <RaisedBedDetailedPlantBatch
            batchSeed={batchSeed}
            batchedData={batchedData}
            definition={definition}
        />
    );
}
