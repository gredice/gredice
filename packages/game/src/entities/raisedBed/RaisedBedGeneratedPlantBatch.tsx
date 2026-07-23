'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
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

export interface RaisedBedGeneratedPlantBatchInstance {
    generation: number;
    position: readonly [number, number, number];
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
    const { symbols } = useGeneratedLSystemSymbolsBatch(tasks);
    const batchedData = useMemo(() => {
        if (!renderDetailedGeometry) {
            return null;
        }

        if (
            symbols.length !== instances.length ||
            symbols.some((result) => result === null)
        ) {
            return null;
        }

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
        symbols.forEach((lSystemSymbols, index) => {
            const instance = instances[index];
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
        return {
            flowers,
            leafColors,
            leaves,
            stemSegments,
            thorns,
            vegetables,
        } satisfies DetailedBatchedPlantRenderData;
    }, [
        definition,
        flowerGrowth,
        fruitGrowth,
        instances,
        renderDetailedGeometry,
        showProduce,
        symbols,
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
                billboards={billboards}
                debugName={`RaisedBedPlantBillboards:${definition.name}:pending-near`}
                level="mid"
            />
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
