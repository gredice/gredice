'use client';

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { buildDevelopmentalPlantRenderData } from './developmental/buildDevelopmentalPlantRenderData';
import {
    buildDevelopmentalPlantGraph,
    type DevelopmentalPlantGraph,
} from './developmental/developmentalPlantGraph';
import { usePlantLod } from './hooks/usePlantLod';
import type { PlantDefinition } from './lib/plant-definitions';
import { getApproximatePlantHeight } from './lib/plantRenderData';
import { Flowers } from './parts/flowers';
import { Leaves } from './parts/leaves';
import { PlantBillboard } from './parts/PlantBillboard';
import { Stems } from './parts/stems';
import { Thorns } from './parts/thorns';
import { Vegetables } from './parts/vegetables';

interface PlantGeneratorProps {
    plantDefinition: PlantDefinition;
    generation: number;
    seed: string;
    graph?: DevelopmentalPlantGraph;
    flowerGrowth: number;
    fruitGrowth: number;
    animate?: boolean;
    showLeaves?: boolean;
    showFlowers?: boolean;
    showProduce?: boolean;
}

export function PlantGenerator({
    plantDefinition,
    generation,
    seed,
    graph: suppliedGraph,
    flowerGrowth,
    fruitGrowth,
    animate = true,
    showLeaves = true,
    showFlowers = true,
    showProduce = true,
}: PlantGeneratorProps) {
    const groupRef = useRef<THREE.Group | null>(null);
    const lodLevel = usePlantLod(
        groupRef,
        getApproximatePlantHeight(plantDefinition),
    );
    const renderData = useMemo(() => {
        const graph =
            suppliedGraph ??
            buildDevelopmentalPlantGraph({
                generation,
                plantDefinition,
                seed,
            });
        return buildDevelopmentalPlantRenderData({
            flowerGrowth,
            fruitGrowth,
            graph,
            plantDefinition,
            renderDetailedGeometry: lodLevel === 'near',
            showFlowers,
            showLeaves,
            showProduce,
        });
    }, [
        flowerGrowth,
        fruitGrowth,
        generation,
        lodLevel,
        plantDefinition,
        seed,
        showFlowers,
        showLeaves,
        showProduce,
        suppliedGraph,
    ]);

    return (
        <group ref={groupRef}>
            {lodLevel === 'near' ? (
                <group name={`PlantGenerator:${plantDefinition.name}:near`}>
                    <Stems
                        seed={seed}
                        segments={renderData.stemSegments}
                        stem={plantDefinition.stem}
                        animate={animate}
                        debugName={`PlantStems:${plantDefinition.name}:${seed}:segments:${renderData.stemSegments.length}`}
                    />
                    {showLeaves && (
                        <Leaves
                            seed={seed}
                            matrices={renderData.leaves}
                            colors={renderData.leafColors}
                            type={plantDefinition.leaf.type}
                            animate={animate}
                            debugName={`PlantLeaves:${plantDefinition.name}:${seed}:count:${renderData.leaves.length}`}
                        />
                    )}
                    {showFlowers && plantDefinition.flower.enabled && (
                        <Flowers
                            seed={seed}
                            matrices={renderData.flowers}
                            color={plantDefinition.flower.color}
                            form={plantDefinition.development.reproduction.form}
                            animate={animate}
                        />
                    )}
                    {showProduce && plantDefinition.vegetable.enabled && (
                        <Vegetables
                            seed={seed}
                            vegetables={renderData.vegetables}
                            animate={animate}
                        />
                    )}
                    {plantDefinition.thorn?.enabled && (
                        <Thorns
                            seed={seed}
                            matrices={renderData.thorns}
                            color={plantDefinition.thorn.color}
                            animate={animate}
                        />
                    )}
                </group>
            ) : (
                <PlantBillboard
                    animate={animate}
                    level={lodLevel}
                    seed={seed}
                    summary={renderData.lodSummary}
                />
            )}
        </group>
    );
}
