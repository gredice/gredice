import * as THREE from 'three';
import type { PlantDefinition } from './plant-definitions';
import type { PlantLodSummary } from './plantRenderData';
import { SeededRNG } from './rng';
import { resolveVegetableColor } from './vegetableRenderMetadata';

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
    start: number,
    matureAt: number,
) {
    if (generation < start) {
        return 0;
    }
    if (matureAt <= start) {
        return 1;
    }
    return THREE.MathUtils.smoothstep(generation, start, matureAt);
}

export function getNominalMaturePlantHeight(plantDefinition: PlantDefinition) {
    const { development } = plantDefinition;
    const isBasal =
        development.architecture === 'rosette' ||
        development.architecture === 'clump';
    const isProstrate = development.axes.habit === 'prostrate';
    const storageHeight = development.storage
        ? plantDefinition.vegetable.baseSize *
          development.storage.sizeScale *
          Math.max(0.5, development.storage.aboveSoilFraction)
        : 0;
    const basalFoliageHeight =
        plantDefinition.leaf.size *
        (1.05 + development.foliage.petioleLengthScale * 0.5);
    const axialFoliageHeight =
        plantDefinition.height *
            development.axes.internodeLengthScale *
            (isProstrate ? 0.18 : 0.98) +
        plantDefinition.leaf.size;

    return Math.max(
        isBasal ? basalFoliageHeight : axialFoliageHeight,
        storageHeight,
        0.16,
    );
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
    const { development } = plantDefinition;
    const structureGrowth = getLifecycleGrowth(
        generation,
        development.phenology.emergenceStart,
        development.phenology.maturityGeneration,
    );
    const variation = new SeededRNG(`${seed}:lod-summary`);
    const heightVariation = variation.nextRange(0.94, 1.06);
    const canopyVariation = variation.nextRange(0.92, 1.08);
    const stemVariation = variation.nextRange(0.95, 1.05);
    const hasFoliage =
        showLeaves &&
        generation >= development.phenology.emergenceStart &&
        development.foliage.count > 0 &&
        plantDefinition.leaf.size > 0.01;
    const isBasal =
        development.architecture === 'rosette' ||
        development.architecture === 'clump';
    const isProstrate = development.axes.habit === 'prostrate';
    const matureHeight = getNominalMaturePlantHeight(plantDefinition);
    const minimumHeight = Math.max(
        plantDefinition.vegetable.baseSize * 1.2,
        plantDefinition.leaf.size * (isBasal ? 1.1 : 0.7),
        0.16,
    );
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
    const branchHorizontalReach =
        plantDefinition.height *
        development.axes.branchLengthScale *
        Math.sin(THREE.MathUtils.degToRad(development.axes.branchPitchDegrees));
    const architectureWidth = isBasal
        ? plantDefinition.leaf.size *
          2 *
          (1 + development.foliage.petioleLengthScale)
        : isProstrate
          ? plantDefinition.height *
                development.axes.internodeLengthScale *
                1.9 +
            plantDefinition.leaf.size * 2
          : (branchHorizontalReach + plantDefinition.leaf.size) * 2;
    const developedArchitectureWidth = THREE.MathUtils.lerp(
        plantDefinition.leaf.size * 1.4,
        architectureWidth,
        structureGrowth,
    );
    const canopyWidth = hasFoliage
        ? Math.max(
              developedArchitectureWidth * canopyVariation,
              plantDefinition.leaf.size * 1.6,
              0.22,
          )
        : Math.max(stemRadius * 5 * canopyVariation, 0.12);
    const canopyCenterY = hasFoliage
        ? Math.max(height * (isBasal ? 0.24 : 0.62), 0.08)
        : Math.max(height * 0.66, 0.16);
    const reproduction = development.reproduction;
    const storage = development.storage;
    const fruitStart = storage?.birthGeneration ?? reproduction.fruitStart;
    const produceMaturity =
        fruitStart === undefined
            ? 0
            : getLifecycleGrowth(
                  generation,
                  fruitStart,
                  storage?.matureGeneration ?? fruitStart + 2.2,
              );
    const produceGrowth = fruitGrowth * produceMaturity;
    const flowerStageGrowth =
        flowerGrowth *
        getLifecycleGrowth(
            generation,
            reproduction.flowerStart +
                ((development.architecture === 'vine' &&
                    reproduction.flowerStart >= 5.7) ||
                (development.architecture === 'upright' &&
                    development.axes.nodeCount <= 5)
                    ? 0.75
                    : 0),
            reproduction.flowerStart + 1.95,
        );
    let accentColor: string | undefined;
    let accentCenterY = Math.max(height * 0.7, 0.12);

    if (
        showProduce &&
        plantDefinition.vegetable.enabled &&
        produceGrowth > 0.01
    ) {
        accentColor = resolveVegetableColor(
            plantDefinition.vegetable.type,
            produceMaturity,
        );
        if (storage) {
            accentCenterY = Math.max(
                plantDefinition.vegetable.baseSize * storage.aboveSoilFraction,
                0.06,
            );
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
