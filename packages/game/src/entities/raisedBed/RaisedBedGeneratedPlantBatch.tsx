'use client';

import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CSM from 'three-custom-shader-material';
import { useGeneratedLSystemSymbolsBatch } from '../../generators/plant/hooks/useGeneratedLSystem';
import type { PlantLodLevel } from '../../generators/plant/hooks/usePlantLod';
import { usePlantSway } from '../../generators/plant/hooks/usePlantSway';
import { buildPlantRenderData } from '../../generators/plant/lib/buildPlantRenderData';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from '../../generators/plant/lib/plant-definitions';
import {
    createStemSurfaceUniforms,
    stemSurfaceFragmentShader,
    stemSurfaceVertexShader,
} from '../../generators/plant/lib/plant-stem-material';
import { PlantGenerator } from '../../generators/plant/PlantGenerator';
import { Flowers } from '../../generators/plant/parts/flowers';
import { Leaves } from '../../generators/plant/parts/leaves';
import { PlantBillboard } from '../../generators/plant/parts/PlantBillboard';
import { Thorns } from '../../generators/plant/parts/thorns';
import { Vegetables } from '../../generators/plant/parts/vegetables';

interface RaisedBedGeneratedPlantBatchInstance {
    generation: number;
    position: readonly [number, number, number];
    scale: number;
    seed: string;
}

interface RaisedBedGeneratedPlantBatchProps {
    definition: PlantDefinition;
    instances: RaisedBedGeneratedPlantBatchInstance[];
    lodLevel?: PlantLodLevel;
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
    stemGeometry: THREE.BufferGeometry;
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
    const stemSwayUniforms = usePlantSway(batchSeed, {
        amplitude: 0.055,
        speed: 1.1,
    });
    const stemSurfaceUniforms = useMemo(
        () => createStemSurfaceUniforms(definition.stem),
        [definition.stem],
    );

    return (
        <group>
            <mesh geometry={batchedData.stemGeometry} castShadow>
                <CSM
                    baseMaterial={THREE.MeshStandardMaterial}
                    vertexShader={stemSurfaceVertexShader}
                    fragmentShader={stemSurfaceFragmentShader}
                    uniforms={{
                        ...stemSwayUniforms,
                        ...stemSurfaceUniforms,
                    }}
                    color={definition.stem.color}
                    roughness={0.8}
                    metalness={0.2}
                />
            </mesh>
            <Leaves
                seed={`${batchSeed}-leaves`}
                matrices={batchedData.leaves}
                colors={batchedData.leafColors}
                type={definition.leaf.type}
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
    instances,
    lodLevel = 'near',
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
        const stemGeometries: THREE.BufferGeometry[] = [];
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
                flowerGrowth: 1,
                fruitGrowth: 1,
                generation: clampedGeneration,
                lSystemSymbols,
                plantDefinition: definition,
                renderDetailedGeometry,
                seed: instance.seed,
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
                plantData.stemGeometry.dispose();
                return;
            }

            if (plantData.stemGeometry.getAttribute('position')) {
                plantData.stemGeometry.applyMatrix4(rootMatrix);
                stemGeometries.push(plantData.stemGeometry);
            } else {
                plantData.stemGeometry.dispose();
            }

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
        const stemGeometry = stemGeometries.length
            ? mergeGeometries(stemGeometries)
            : new THREE.BufferGeometry();
        stemGeometries.forEach((geometry) => {
            geometry.dispose();
        });

        return {
            billboards,
            flowers,
            leafColors,
            leaves,
            stemGeometry,
            thorns,
            vegetables,
        } satisfies BatchedPlantRenderData;
    }, [definition, instances, renderDetailedGeometry, symbols]);

    useLayoutEffect(() => {
        return () => {
            batchedData?.stemGeometry.dispose();
        };
    }, [batchedData]);

    if (!batchedData) {
        return null;
    }

    if (lodLevel !== 'near') {
        return (
            <group>
                {batchedData.billboards.map((billboard) => (
                    <group
                        key={billboard.seed}
                        position={billboard.position}
                        scale={[
                            billboard.scale,
                            billboard.scale,
                            billboard.scale,
                        ]}
                    >
                        <PlantBillboard
                            level={lodLevel}
                            summary={billboard.summary}
                        />
                    </group>
                ))}
            </group>
        );
    }

    if (instances.length <= 1 && symbols[0]) {
        const [instance] = instances;

        return (
            <group
                position={instance.position}
                scale={[instance.scale, instance.scale, instance.scale]}
            >
                <PlantGenerator
                    plantDefinition={definition}
                    lSystemSymbols={symbols[0]}
                    generation={instance.generation}
                    seed={instance.seed}
                    flowerGrowth={1}
                    fruitGrowth={1}
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
