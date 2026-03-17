'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { usePlantLod } from './hooks/usePlantLod';
import { usePlantSway } from './hooks/usePlantSway';
import {
    buildPlantRenderData,
    getApproximatePlantHeight,
} from './lib/buildPlantRenderData';
import type { LSystemSymbol } from './lib/l-system';
import type { PlantDefinition } from './lib/plant-definitions';
import {
    createStemSurfaceUniforms,
    stemSurfaceFragmentShader,
    stemSurfaceVertexShader,
} from './lib/plant-stem-material';
import { Flowers } from './parts/flowers';
import { Leaves } from './parts/leaves';
import { PlantBillboard } from './parts/PlantBillboard';
import { Thorns } from './parts/thorns';
import { Vegetables } from './parts/vegetables';

interface PlantGeneratorProps {
    plantDefinition: PlantDefinition;
    lSystemSymbols: LSystemSymbol[];
    generation: number;
    seed: string;
    flowerGrowth: number;
    fruitGrowth: number;
    showLeaves?: boolean;
    showFlowers?: boolean;
    showProduce?: boolean;
}

export function PlantGenerator({
    plantDefinition,
    lSystemSymbols,
    generation,
    seed,
    flowerGrowth,
    fruitGrowth,
    showLeaves = true,
    showFlowers = true,
    showProduce = true,
}: PlantGeneratorProps) {
    const stemSwayUniforms = usePlantSway(seed, {
        amplitude: 0.055,
        speed: 1.1,
    });
    const stemSurfaceUniforms = useMemo(
        () => createStemSurfaceUniforms(plantDefinition.stem),
        [plantDefinition.stem],
    );
    const groupRef = useRef<THREE.Group | null>(null);
    const lodLevel = usePlantLod(
        groupRef,
        getApproximatePlantHeight(plantDefinition, generation),
    );
    const renderData = useMemo(() => {
        return buildPlantRenderData({
            flowerGrowth,
            fruitGrowth,
            generation,
            lSystemSymbols,
            plantDefinition,
            renderDetailedGeometry: lodLevel === 'near',
            seed,
            showFlowers,
            showLeaves,
            showProduce,
        });
    }, [
        flowerGrowth,
        fruitGrowth,
        generation,
        lSystemSymbols,
        lodLevel,
        plantDefinition,
        seed,
        showFlowers,
        showLeaves,
        showProduce,
    ]);

    return (
        <group ref={groupRef}>
            {lodLevel === 'near' ? (
                <group>
                    {plantDefinition.support?.enabled && (
                        <mesh
                            geometry={renderData.supportGeometry}
                            castShadow
                            receiveShadow
                        >
                            <meshStandardMaterial
                                color={plantDefinition.support.color}
                                roughness={0.92}
                                metalness={0.08}
                            />
                        </mesh>
                    )}
                    <mesh geometry={renderData.stemGeometry} castShadow>
                        <CSM
                            baseMaterial={THREE.MeshStandardMaterial}
                            vertexShader={stemSurfaceVertexShader}
                            fragmentShader={stemSurfaceFragmentShader}
                            uniforms={{
                                ...stemSwayUniforms,
                                ...stemSurfaceUniforms,
                            }}
                            color={plantDefinition.stem.color}
                            roughness={0.8}
                            metalness={0.2}
                        />
                    </mesh>
                    {showLeaves && (
                        <Leaves
                            seed={seed}
                            matrices={renderData.leaves}
                            colors={renderData.leafColors}
                            type={plantDefinition.leaf.type}
                        />
                    )}
                    {showFlowers && plantDefinition.flower.enabled && (
                        <Flowers
                            seed={seed}
                            matrices={renderData.flowers}
                            color={plantDefinition.flower.color}
                        />
                    )}
                    {showProduce && plantDefinition.vegetable.enabled && (
                        <Vegetables
                            seed={seed}
                            vegetables={renderData.vegetables}
                        />
                    )}
                    {plantDefinition.thorn?.enabled && (
                        <Thorns
                            seed={seed}
                            matrices={renderData.thorns}
                            color={plantDefinition.thorn.color}
                        />
                    )}
                </group>
            ) : (
                <PlantBillboard
                    level={lodLevel}
                    summary={renderData.lodSummary}
                />
            )}
        </group>
    );
}
