import {
    type GameAssetName,
    gameAssetModels,
} from '../../../packages/game/src/data/models';
import { MAX_PLANT_GENERATION } from '../../../packages/game/src/generators/plant/lib/plant-definition-types';
import { plantTypes } from '../../../packages/game/src/generators/plant/lib/plant-presets';
import type { OperationCoverRecipe } from '../../../packages/game/src/viewers/OperationCoverSnapshotViewer';

export const OPERATION_ICON_SIZE = 160;
export const OPERATION_ICON_DEVICE_SCALE_FACTOR = 4;

const liquidPreparationBottleAssets = [
    'LiquidPreparationBottlePestControl',
    'LiquidPreparationBottleAphidControl',
    'LiquidPreparationBottleSlugControl',
    'LiquidPreparationBottleTomatoEggplantResistance',
    'LiquidPreparationBottleFertilizer',
    'LiquidPreparationBottleDiseaseControl',
    'LiquidPreparationBottleWeevilControl',
    'LiquidPreparationBottleVoleControl',
    'LiquidPreparationBottleBeetleControl',
] as const satisfies readonly GameAssetName[];

export const liquidPreparationOperationCoverRecipes =
    liquidPreparationBottleAssets.map((assetName) => ({
        operationId: assetName,
        operationLabel: assetName,
        outputFileName: `${assetName}.webp`,
        camera: {
            position: [0.5, 0.62, 7],
            target: [0.5, 0.62, 0.5],
            zoom: 118,
        },
        entities: [
            {
                entityName: assetName,
                position: [0.5, 0, 0.5],
            },
        ],
        showBackground: false,
    })) satisfies readonly OperationCoverRecipe[];

export const operationCoverRecipes = [
    ...liquidPreparationOperationCoverRecipes,
] satisfies readonly OperationCoverRecipe[];

export function validateOperationCoverRecipes(
    recipes: readonly OperationCoverRecipe[],
) {
    const errors: string[] = [];
    const outputFileNames = new Set<string>();

    if (recipes.length === 0) {
        errors.push('At least one operation cover recipe is required.');
    }

    for (const recipe of recipes) {
        if (!recipe.operationId.trim()) {
            errors.push(`${recipe.outputFileName}: operationId is required.`);
        }

        if (!recipe.operationLabel.trim()) {
            errors.push(
                `${recipe.outputFileName}: operationLabel is required.`,
            );
        }

        if (!recipe.outputFileName.endsWith('.webp')) {
            errors.push(
                `${recipe.operationId}: outputFileName must end with .webp.`,
            );
        }

        if (outputFileNames.has(recipe.outputFileName)) {
            errors.push(
                `${recipe.outputFileName}: outputFileName must be unique.`,
            );
        }
        outputFileNames.add(recipe.outputFileName);

        if (
            !recipe.assets?.length &&
            !recipe.entities?.length &&
            !recipe.plants?.length
        ) {
            errors.push(
                `${recipe.outputFileName}: recipe must include at least one asset, entity, or plant.`,
            );
        }

        for (const asset of recipe.assets ?? []) {
            if (!Object.hasOwn(gameAssetModels, asset.assetName)) {
                errors.push(
                    `${recipe.outputFileName}: unknown game asset ${asset.assetName}.`,
                );
            }
        }

        for (const entity of recipe.entities ?? []) {
            if (!Object.hasOwn(gameAssetModels, entity.entityName)) {
                errors.push(
                    `${recipe.outputFileName}: unknown game entity ${entity.entityName}.`,
                );
            }
        }

        for (const plant of recipe.plants ?? []) {
            if (!Object.hasOwn(plantTypes, plant.plantType)) {
                errors.push(
                    `${recipe.outputFileName}: unknown plant type ${plant.plantType}.`,
                );
            }

            const generation = plant.generation ?? MAX_PLANT_GENERATION * 0.75;
            if (generation < 0 || generation > MAX_PLANT_GENERATION) {
                errors.push(
                    `${recipe.outputFileName}: plant generation ${generation} is outside 0-${MAX_PLANT_GENERATION}.`,
                );
            }
        }
    }

    return errors;
}
