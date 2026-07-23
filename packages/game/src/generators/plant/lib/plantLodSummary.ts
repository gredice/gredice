import * as THREE from 'three';
import type { PlantLodSummary } from './buildPlantRenderData';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from './plant-definitions';
import { SeededRNG } from './rng';
import { vegetableMaterialProps } from './vegetableRenderMetadata';

const FLOWER_MATURITY_WINDOW = 2;

interface BuildApproximatePlantLodSummaryOptions {
    flowerGrowth: number;
    fruitGrowth: number;
    generation: number;
    plantDefinition: PlantDefinition;
    seed: string;
    showFlowers?: boolean;
    showLeaves?: boolean;
    showProduce?: boolean;
}

function getLifecycleGrowth(
    generation: number,
    ageStart: number,
    matureAt: number,
) {
    if (generation < ageStart) {
        return 0;
    }

    if (matureAt <= ageStart) {
        return 1;
    }

    const linearProgress = THREE.MathUtils.clamp(
        (generation - ageStart + 1) / (matureAt - ageStart + 1),
        0,
        1,
    );

    return THREE.MathUtils.smoothstep(linearProgress, 0, 1);
}

export function buildApproximatePlantLodSummary({
    flowerGrowth,
    fruitGrowth,
    generation,
    plantDefinition,
    seed,
    showFlowers = true,
    showLeaves = true,
    showProduce = true,
}: BuildApproximatePlantLodSummaryOptions): PlantLodSummary {
    const clampedGeneration = THREE.MathUtils.clamp(
        generation,
        0,
        MAX_PLANT_GENERATION,
    );
    const structureGrowth = THREE.MathUtils.smoothstep(
        clampedGeneration,
        0,
        MAX_PLANT_GENERATION,
    );
    const variation = new SeededRNG(`${seed}:lod-summary`);
    const heightVariation = variation.nextRange(0.94, 1.06);
    const canopyVariation = variation.nextRange(0.92, 1.08);
    const stemVariation = variation.nextRange(0.95, 1.05);
    const hasFoliage =
        showLeaves &&
        clampedGeneration > 0.01 &&
        plantDefinition.leaf.density > 0 &&
        plantDefinition.leaf.size > 0.01;
    const minimumHeight = Math.max(
        plantDefinition.height * 0.55,
        plantDefinition.vegetable.baseSize * 1.6,
        0.24,
    );
    const matureHeight = plantDefinition.axiom.includes('R')
        ? minimumHeight
        : Math.max(minimumHeight, plantDefinition.height);
    const height = Math.max(
        minimumHeight,
        THREE.MathUtils.lerp(minimumHeight, matureHeight, structureGrowth) *
            heightVariation,
    );
    const stemRadius = Math.max(
        plantDefinition.stem.minRadius,
        plantDefinition.stem.radius * structureGrowth,
    );
    const stemWidth = Math.max(stemRadius * 4.5 * stemVariation, 0.05);
    const canopyGrowthMultiplier = THREE.MathUtils.lerp(
        1,
        plantDefinition.stem.surface === 'bark' ? 1.7 : 1,
        structureGrowth,
    );
    const canopyWidth = hasFoliage
        ? Math.max(
              plantDefinition.leaf.size *
                  1.6 *
                  canopyVariation *
                  canopyGrowthMultiplier,
              0.22,
          )
        : Math.max(stemRadius * 5 * canopyVariation, 0.12);
    const canopyCenterY = hasFoliage
        ? Math.max(
              height * THREE.MathUtils.lerp(0.38, 0.66, structureGrowth),
              0.08,
          )
        : Math.max(height * 0.66, 0.16);
    const flowerStageGrowth =
        flowerGrowth *
        getLifecycleGrowth(
            clampedGeneration,
            plantDefinition.flower.ageStart,
            Math.min(
                MAX_PLANT_GENERATION,
                plantDefinition.flower.ageStart + FLOWER_MATURITY_WINDOW,
            ),
        );
    const vegetableStageGrowth =
        fruitGrowth *
        getLifecycleGrowth(
            clampedGeneration,
            plantDefinition.vegetable.ageStart,
            MAX_PLANT_GENERATION,
        );
    let accentColor: string | undefined;
    let accentCenterY = Math.max(height * 0.7, 0.12);

    if (
        plantDefinition.vegetable.enabled &&
        clampedGeneration >= plantDefinition.vegetable.ageStart &&
        vegetableStageGrowth > 0.01
    ) {
        if (showProduce) {
            accentColor =
                vegetableMaterialProps[plantDefinition.vegetable.type].color;
            if (plantDefinition.axiom.includes('R')) {
                accentCenterY = Math.max(
                    plantDefinition.vegetable.baseSize * 0.35,
                    0.08,
                );
            }
        }
    } else if (
        showFlowers &&
        plantDefinition.flower.enabled &&
        flowerStageGrowth > 0.01
    ) {
        accentColor = plantDefinition.flower.color;
    }

    const dominantColor = new THREE.Color(plantDefinition.stem.color);
    dominantColor.lerp(
        new THREE.Color(plantDefinition.leaf.color),
        showLeaves ? 0.68 : 0.2,
    );
    if (accentColor) {
        dominantColor.lerp(new THREE.Color(accentColor), 0.16);
    }

    return {
        accentCenterY,
        accentColor,
        canopyCenterY,
        canopyWidth,
        dominantColor: `#${dominantColor.getHexString()}`,
        foliageColor: plantDefinition.leaf.color,
        hasFoliage,
        height,
        stemColor: plantDefinition.stem.color,
        stemWidth,
    };
}
