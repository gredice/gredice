import {
    buildGeneratedPlantRenderData,
    generatePlantTopology,
} from './generatedPlantRenderData';
import {
    getGeneratedPlantTemplateSeed,
    resolveGeneratedPlantTemplateVariant,
} from './generatedPlantTemplates';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from './plant-definition-types';
import type { PlantLodSummary } from './plantRenderData';

export { getNominalMaturePlantHeight } from './plantNominalHeight';

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

/** Summaries kept per plant definition before the oldest is dropped. */
export const PLANT_LOD_SUMMARY_CACHE_LIMIT = 256;

const templateLodSummaryCache = new WeakMap<
    PlantDefinition,
    Map<string, PlantLodSummary>
>();

/**
 * The far and mid summary of a plant in a raised bed: the size, colours and
 * produce of the 3D plant the near view draws for the same instance seed.
 *
 * A bed's near view draws one of a few shared templates per definition and
 * generation (`resolveGeneratedPlantTemplateVariant`). This builds that
 * template's organ graph without geometry, which costs a fraction of a
 * millisecond, and keeps the summary per definition, so a bed of plants of
 * one age builds it once. The cards then match the 3D plant when the camera
 * zooms between levels of detail, instead of an estimate from the definition
 * that missed sprawling and basal crops by up to half their width.
 *
 * The instance scale and yaw variation stay with the caller, as in the near
 * view.
 */
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
    const templateGeneration = Math.min(
        MAX_PLANT_GENERATION,
        Math.max(0, generation),
    );
    const variant = resolveGeneratedPlantTemplateVariant(seed);
    const key = JSON.stringify([
        templateGeneration,
        variant,
        flowerGrowth,
        fruitGrowth,
        showFlowers,
        showLeaves,
        showProduce,
    ]);
    let summaries = templateLodSummaryCache.get(plantDefinition);
    if (!summaries) {
        summaries = new Map();
        templateLodSummaryCache.set(plantDefinition, summaries);
    }

    let summary = summaries.get(key);
    if (!summary) {
        summary = buildGeneratedPlantRenderData({
            flowerGrowth,
            fruitGrowth,
            plantDefinition,
            renderDetailedGeometry: false,
            showFlowers,
            showLeaves,
            showProduce,
            topology: generatePlantTopology({
                generation: templateGeneration,
                plantDefinition,
                seed: getGeneratedPlantTemplateSeed({
                    definition: plantDefinition,
                    variant,
                }),
            }),
        }).lodSummary;
        if (summaries.size >= PLANT_LOD_SUMMARY_CACHE_LIMIT) {
            const oldestKey = summaries.keys().next().value;
            if (oldestKey !== undefined) {
                summaries.delete(oldestKey);
            }
        }
        summaries.set(key, summary);
    }

    return { ...summary };
}
