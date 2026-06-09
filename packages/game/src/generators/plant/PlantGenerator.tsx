'use client';

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { usePlantLod } from './hooks/usePlantLod';
import {
    buildPlantRenderData,
    getApproximatePlantHeight,
} from './lib/buildPlantRenderData';
import type { LSystemSymbol } from './lib/l-system';
import type { PlantDefinition } from './lib/plant-definitions';
import { Flowers } from './parts/flowers';
import { Leaves } from './parts/leaves';
import { PlantBillboard } from './parts/PlantBillboard';
import { Stems } from './parts/stems';
import { Thorns } from './parts/thorns';
import { Vegetables } from './parts/vegetables';

interface PlantGeneratorProps {
    plantDefinition: PlantDefinition;
    lSystemSymbols: LSystemSymbol[];
    generation: number;
    seed: string;
    flowerGrowth: number;
    fruitGrowth: number;
    animate?: boolean;
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
    animate = true,
    showLeaves = true,
    showFlowers = true,
    showProduce = true,
}: PlantGeneratorProps) {
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
                    level={lodLevel}
                    summary={renderData.lodSummary}
                />
            )}
        </group>
    );
}
