'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useGeneratedLSystemSymbolsBatch } from '../../generators/plant/hooks/useGeneratedLSystem';
import {
    buildPlantRenderData,
    type PlantStemSegment,
} from '../../generators/plant/lib/buildPlantRenderData';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from '../../generators/plant/lib/plant-definitions';
import type { PlantLodLevel } from '../../generators/plant/lib/plantLod';
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

type BatchedPlantRenderData = {
    billboards: Array<{
        position: readonly [number, number, number];
        scale: number;
        seed: string;
        summary: ReturnType<typeof buildPlantRenderData>['lodSummary'];
    }>;
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
    batchedData: BatchedPlantRenderData;
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
    const batchSeed = useMemo(
        () =>
            `${definition.name}:${instances.map((instance) => instance.seed).join('|')}`,
        [definition.name, instances],
    );
    const tasks = useMemo(() => {
        return instances.map((instance) => ({
            axiom: definition.axiom,
            iterations: Math.ceil(
                Math.min(
                    MAX_PLANT_GENERATION,
                    Math.max(0, instance.generation),
                ),
            ),
            rules: definition.rules,
            seed: instance.seed,
        }));
    }, [definition.axiom, definition.rules, instances]);
    const { symbols } = useGeneratedLSystemSymbolsBatch(tasks);
    const batchedData = useMemo(() => {
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
        const billboards: Array<{
            position: readonly [number, number, number];
            scale: number;
            seed: string;
            summary: ReturnType<typeof buildPlantRenderData>['lodSummary'];
        }> = [];

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
            billboards.push({
                position: instance.position,
                scale: instance.scale,
                seed: instance.seed,
                summary: plantData.lodSummary,
            });

            rootPosition.set(...instance.position);
            rootScale.setScalar(instance.scale);
            rootMatrix.compose(rootPosition, ROOT_QUATERNION, rootScale);

            if (!renderDetailedGeometry) {
                return;
            }

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
            billboards,
            flowers,
            leafColors,
            leaves,
            stemSegments,
            thorns,
            vegetables,
        } satisfies BatchedPlantRenderData;
    }, [
        definition,
        flowerGrowth,
        fruitGrowth,
        instances,
        renderDetailedGeometry,
        showProduce,
        symbols,
    ]);

    if (!batchedData) {
        return null;
    }

    if (lodLevel !== 'near') {
        return (
            <PlantBillboardBatch
                billboards={batchedData.billboards}
                debugName={`RaisedBedPlantBillboards:${definition.name}`}
                level={lodLevel}
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
