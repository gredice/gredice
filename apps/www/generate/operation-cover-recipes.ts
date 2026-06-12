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

const raisedBedCompactNodes = ['Raised_Bed_O_1', 'Raised_Bed_O_2'] as const;

const waterSprayDropletNodes = [
    'WaterSprayKit_Droplet_01',
    'WaterSprayKit_Droplet_02',
    'WaterSprayKit_Droplet_03',
    'WaterSprayKit_Droplet_04',
] as const;

const waterSprayNozzleNodes = [
    'WaterSprayKit_Hose_A',
    'WaterSprayKit_Hose_B',
    'WaterSprayKit_Wand',
    'WaterSprayKit_Nozzle',
] as const;

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

export const waterOperationCoverRecipes = [
    {
        operationId: 'watterSurfaceRaisedBed',
        operationLabel: 'Površinsko zalijevanje gredice (20L)',
        outputFileName: 'watterSurfaceRaisedBed.webp',
        camera: {
            position: [2.8, 2.2, 5],
            target: [0.45, 0.25, 0.45],
            zoom: 100,
        },
        assets: [
            {
                assetName: 'RaisedBed',
                visibleNodeNames: raisedBedCompactNodes,
                position: [0.45, -0.05, 0.45],
                rotation: [0, 0.72, 0],
                scale: 0.42,
            },
            {
                assetName: 'WateringCan',
                position: [0.29, 0.55, 0.5],
                rotation: [-0.35, 0.75, -0.75],
                scale: 0.13,
            },
            {
                assetName: 'WaterSprayKit',
                visibleNodeNames: waterSprayDropletNodes,
                position: [0.42, 0.12, 0.44],
                rotation: [0.15, 0.2, -0.3],
                scale: 0.28,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'watterRaisedBed',
        operationLabel: 'Zalijevanje gredice (50L)',
        outputFileName: 'watterRaisedBed.webp',
        camera: {
            position: [2.8, 2.2, 5],
            target: [0.45, 0.25, 0.45],
            zoom: 102,
        },
        assets: [
            {
                assetName: 'RaisedBed',
                visibleNodeNames: raisedBedCompactNodes,
                position: [0.45, -0.06, 0.45],
                rotation: [0, 0.72, 0],
                scale: 0.4,
            },
            {
                id: 'bucket-left',
                assetName: 'Bucket',
                position: [0.22, 0.05, 0.25],
                rotation: [0, 0.35, 0],
                scale: 0.18,
            },
            {
                id: 'bucket-right',
                assetName: 'Bucket',
                position: [0.66, 0.05, 0.34],
                rotation: [0, -0.45, 0],
                scale: 0.18,
            },
            {
                id: 'bucket-front',
                assetName: 'Bucket',
                position: [0.35, 0.05, 0.62],
                rotation: [0, 0.1, 0],
                scale: 0.18,
            },
            {
                id: 'water-glints',
                assetName: 'WaterSprayKit',
                visibleNodeNames: waterSprayDropletNodes,
                position: [0.43, 0.2, 0.48],
                rotation: [0.15, 0.2, -0.3],
                scale: 0.24,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'watteringSystemSprinkler2',
        operationLabel: 'Sustav navodnjavanja - 2 prskalice',
        outputFileName: 'watteringSystemSprinkler2.webp',
        camera: {
            position: [2.8, 2.2, 5],
            target: [0.45, 0.25, 0.45],
            zoom: 104,
        },
        assets: [
            {
                assetName: 'RaisedBed',
                visibleNodeNames: raisedBedCompactNodes,
                position: [0.45, -0.06, 0.45],
                rotation: [0, 0.72, 0],
                scale: 0.4,
            },
            {
                id: 'sprinkler-left',
                assetName: 'WaterSprayKit',
                visibleNodeNames: waterSprayNozzleNodes,
                position: [0.22, 0.04, 0.34],
                rotation: [0.18, 0.75, -0.45],
                scale: 0.43,
            },
            {
                id: 'sprinkler-right',
                assetName: 'WaterSprayKit',
                visibleNodeNames: waterSprayNozzleNodes,
                position: [0.68, 0.04, 0.38],
                rotation: [0.18, -0.8, 0.45],
                scale: 0.43,
            },
            {
                id: 'spray-left',
                assetName: 'WaterSprayKit',
                visibleNodeNames: waterSprayDropletNodes,
                position: [0.34, 0.24, 0.38],
                rotation: [0.1, 0.2, -0.4],
                scale: 0.26,
            },
            {
                id: 'spray-right',
                assetName: 'WaterSprayKit',
                visibleNodeNames: waterSprayDropletNodes,
                position: [0.56, 0.25, 0.42],
                rotation: [0.1, -0.2, 0.4],
                scale: 0.26,
            },
        ],
        showBackground: false,
    },
] satisfies readonly OperationCoverRecipe[];

export const operationCoverRecipes = [
    ...liquidPreparationOperationCoverRecipes,
    ...waterOperationCoverRecipes,
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
