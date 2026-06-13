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

const pestBugAphidNodes = [
    'PestBugKit_Aphid_Body',
    'PestBugKit_Aphid_Head',
    'PestBugKit_Aphid_Legs',
] as const;

const pestBugBeetleNodes = [
    'PestBugKit_Beetle_Body',
    'PestBugKit_Beetle_Shell',
    'PestBugKit_Beetle_Shell_Stripe',
    'PestBugKit_Beetle_Head',
    'PestBugKit_Beetle_Legs',
] as const;

const pestBugLeafDamageNodes = [
    'PestBugKit_Leaf_Damage_Leaf',
    'PestBugKit_Leaf_Damage_Bite_01',
    'PestBugKit_Leaf_Damage_Bite_02',
    'PestBugKit_Leaf_Damage_Bite_03',
    'PestBugKit_Leaf_Damage_Stem',
] as const;

const gardenFlowerHeadNodes = [
    'GardenFlower_Petals',
    'GardenFlower_Center',
] as const;

const gardenFlowerLeafNodes = [
    'GardenFlower_Leaves',
    'GardenFlower_Stem',
] as const;

const harvestBasketBaseNodes = [
    'HarvestBasket_Weave',
    'HarvestBasket_Rim',
    'HarvestBasket_Inner',
    'HarvestBasket_Handle',
    'HarvestBasket_Pin',
] as const;

const harvestBasketTomatoNodes = [
    ...harvestBasketBaseNodes,
    'HarvestBasket_Tomato',
    'HarvestBasket_TomatoCalyx',
] as const;

const harvestBasketLooseTomatoNodes = [
    'HarvestBasket_Tomato',
    'HarvestBasket_TomatoCalyx',
] as const;

const harvestBasketHalfNodes = [
    ...harvestBasketTomatoNodes,
    'HarvestBasket_Carrot',
    'HarvestBasket_CarrotGreens',
    'HarvestBasket_Zucchini',
] as const;

const harvestBasketGreensNodes = [
    ...harvestBasketBaseNodes,
    'HarvestBasket_Cabbage',
    'HarvestBasket_Turnip',
    'HarvestBasket_TurnipSprout',
    'HarvestBasket_CarrotGreens',
] as const;

const harvestBasketFullNodes = [
    ...harvestBasketHalfNodes,
    'HarvestBasket_Cabbage',
    'HarvestBasket_Turnip',
    'HarvestBasket_TurnipSprout',
    'HarvestBasket_Pumpkin',
    'HarvestBasket_PumpkinStem',
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
    {
        operationId: 'rinsePestsFromPlant',
        operationLabel: 'Ispiranje biljke od štetnika',
        outputFileName: 'rinsePestsFromPlant.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.45, 0.36, 0.45],
            zoom: 134,
        },
        plants: [
            {
                id: 'plant',
                plantType: 'basil',
                generation: 9,
                seed: 'operation-cover-rinse-pests',
                position: [0.45, 0.08, 0.45],
                scale: 1.08,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                id: 'spray-nozzle',
                assetName: 'WaterSprayKit',
                visibleNodeNames: waterSprayNozzleNodes,
                position: [0.08, 0.39, 0.5],
                rotation: [0.1, 0.85, -0.55],
                scale: 0.34,
            },
            {
                id: 'spray-drops',
                assetName: 'WaterSprayKit',
                visibleNodeNames: waterSprayDropletNodes,
                position: [0.32, 0.32, 0.48],
                rotation: [0.12, 0.25, -0.35],
                scale: 0.26,
            },
            {
                id: 'aphid',
                assetName: 'PestBugKit',
                visibleNodeNames: pestBugAphidNodes,
                position: [0.36, 0.34, 0.38],
                rotation: [0.1, 0.2, -0.1],
                scale: 0.22,
            },
            {
                id: 'beetle',
                assetName: 'PestBugKit',
                visibleNodeNames: pestBugBeetleNodes,
                position: [0.58, 0.2, 0.5],
                rotation: [0.1, -0.35, 0.2],
                scale: 0.18,
            },
        ],
        showBackground: false,
    },
] satisfies readonly OperationCoverRecipe[];

export const harvestOperationCoverRecipes = [
    {
        operationId: 'harvest25Mature',
        operationLabel: 'Branje 25% najzrelijih plodova',
        outputFileName: 'harvest25Mature.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.45, 0.3, 0.45],
            zoom: 136,
        },
        plants: [
            {
                id: 'fruiting-plant',
                plantType: 'tomato',
                generation: 8,
                seed: 'operation-cover-harvest-quarter',
                position: [0.34, 0.03, 0.44],
                scale: 0.86,
                showFlowers: false,
            },
        ],
        assets: [
            {
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketTomatoNodes,
                position: [0.62, 0.08, 0.5],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.24,
            },
            {
                id: 'ripe-fruit-highlight',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.57, 0.14, 0.42],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.24,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'harvest50Mature',
        operationLabel: 'Branje 50% najzrelijih plodova',
        outputFileName: 'harvest50Mature.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.45, 0.3, 0.45],
            zoom: 136,
        },
        plants: [
            {
                id: 'fruiting-plant',
                plantType: 'tomato',
                generation: 8,
                seed: 'operation-cover-harvest-half',
                position: [0.34, 0.03, 0.44],
                scale: 0.86,
                showFlowers: false,
            },
        ],
        assets: [
            {
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketHalfNodes,
                position: [0.62, 0.08, 0.5],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.25,
            },
            {
                id: 'ripe-fruit-highlight',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.56, 0.14, 0.42],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.24,
            },
            {
                id: 'ripe-fruit-second',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.62, 0.13, 0.5],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.22,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'harvestPlant',
        operationLabel: 'Branje biljke',
        outputFileName: 'harvestPlant.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.47, 0.22, 0.47],
            zoom: 148,
        },
        assets: [
            {
                id: 'clean-soil-spot',
                assetName: 'MulchWood',
                position: [0.36, 0.02, 0.43],
                rotation: [0.16, 0.45, -0.08],
                scale: [0.18, 0.08, 0.14],
            },
            {
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketGreensNodes,
                position: [0.56, 0.08, 0.5],
                rotation: [0.08, -0.45, 0.03],
                scale: 0.3,
            },
        ],
        plants: [
            {
                id: 'leafy-harvest-left',
                plantType: 'basil',
                generation: 5,
                seed: 'operation-cover-harvest-plant-greens-left',
                position: [0.53, 0.16, 0.46],
                rotation: [0.28, -0.28, -0.65],
                scale: 0.64,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'leafy-harvest-right',
                plantType: 'basil',
                generation: 4,
                seed: 'operation-cover-harvest-plant-greens-right',
                position: [0.62, 0.15, 0.52],
                rotation: [0.28, 0.36, 0.62],
                scale: 0.56,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'leafy-harvest-center',
                plantType: 'basil',
                generation: 4,
                seed: 'operation-cover-harvest-plant-greens-center',
                position: [0.58, 0.15, 0.49],
                rotation: [0.2, 0.1, -0.12],
                scale: 0.44,
                showFlowers: false,
                showProduce: false,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'harvestAll',
        operationLabel: 'Branje svih plodova',
        outputFileName: 'harvestAll.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.45, 0.3, 0.45],
            zoom: 138,
        },
        plants: [
            {
                id: 'emptied-plant',
                plantType: 'tomato',
                generation: 8,
                seed: 'operation-cover-harvest-all-empty',
                position: [0.33, 0.03, 0.44],
                scale: 0.72,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketFullNodes,
                position: [0.63, 0.08, 0.5],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.32,
            },
            {
                id: 'ripe-fruit-front',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.58, 0.16, 0.42],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.28,
            },
            {
                id: 'ripe-fruit-side',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.65, 0.16, 0.5],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.26,
            },
            {
                id: 'ripe-fruit-top',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.61, 0.19, 0.46],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.25,
            },
            {
                id: 'ripe-fruit-back',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.56, 0.17, 0.53],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.23,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'harvestMature',
        operationLabel: 'Branje zrelih plodova',
        outputFileName: 'harvestMature.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.45, 0.3, 0.45],
            zoom: 138,
        },
        plants: [
            {
                id: 'fruiting-plant',
                plantType: 'tomato',
                generation: 8,
                seed: 'operation-cover-harvest-mature',
                position: [0.33, 0.03, 0.44],
                scale: 0.8,
                showFlowers: false,
            },
        ],
        assets: [
            {
                id: 'ripe-fruit-on-plant',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.36, 0.36, 0.4],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.16,
            },
            {
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketHalfNodes,
                position: [0.63, 0.08, 0.5],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.28,
            },
            {
                id: 'ripe-fruit-front',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.58, 0.16, 0.42],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.25,
            },
            {
                id: 'ripe-fruit-top',
                assetName: 'HarvestBasket',
                visibleNodeNames: harvestBasketLooseTomatoNodes,
                position: [0.62, 0.18, 0.48],
                rotation: [0.08, -0.55, 0.05],
                scale: 0.23,
            },
        ],
        showBackground: false,
    },
] satisfies readonly OperationCoverRecipe[];

export const inventoryOperationCoverRecipes = [
    {
        operationId: 'inventoryGreenhouses',
        operationLabel: 'Inventura plastenika',
        outputFileName: 'inventoryGreenhouses.webp',
        camera: {
            position: [2.7, 2.1, 4.8],
            target: [0.46, 0.28, 0.45],
            zoom: 132,
        },
        assets: [
            {
                assetName: 'Greenhouse',
                position: [0.31, 0.04, 0.48],
                rotation: [0.08, 0.72, 0],
                scale: 0.26,
            },
            {
                assetName: 'FieldworkClipboard',
                position: [0.72, 0.24, 0.34],
                rotation: [0.18, -0.55, -0.22],
                scale: 0.16,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'inventoryPlantSupports',
        operationLabel: 'Inventura potpornja',
        outputFileName: 'inventoryPlantSupports.webp',
        camera: {
            position: [2.7, 2.1, 4.8],
            target: [0.45, 0.25, 0.45],
            zoom: 140,
        },
        assets: [
            {
                id: 'support-left',
                assetName: 'Stick',
                position: [0.3, 0.11, 0.48],
                rotation: [0.14, 0.2, -0.62],
                scale: [0.06, 0.38, 0.06],
            },
            {
                id: 'support-center',
                assetName: 'Stick',
                position: [0.39, 0.12, 0.44],
                rotation: [0.1, -0.1, -0.46],
                scale: [0.06, 0.4, 0.06],
            },
            {
                id: 'support-right',
                assetName: 'Stick',
                position: [0.48, 0.11, 0.47],
                rotation: [0.14, -0.4, -0.3],
                scale: [0.06, 0.36, 0.06],
            },
            {
                assetName: 'FieldworkClipboard',
                position: [0.7, 0.22, 0.34],
                rotation: [0.18, -0.55, -0.22],
                scale: 0.16,
            },
        ],
        showBackground: false,
    },
] satisfies readonly OperationCoverRecipe[];

export const cuttingOperationCoverRecipes = [
    {
        operationId: 'formative-pruning',
        operationLabel: 'Formativna rezidba',
        outputFileName: 'formative-pruning.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.39, 0.42, 0.45],
            zoom: 128,
        },
        plants: [
            {
                id: 'plant',
                plantType: 'tomato',
                generation: 7,
                seed: 'operation-cover-formative-pruning',
                position: [0.36, -0.03, 0.45],
                scale: 0.82,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                assetName: 'GardenScissors',
                position: [0.51, 0.48, 0.42],
                rotation: [0.08, -0.65, -0.95],
                scale: 0.25,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'pruning',
        operationLabel: 'Jednostavna rezidba',
        outputFileName: 'pruning.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.43, 0.31, 0.45],
            zoom: 150,
        },
        plants: [
            {
                id: 'plant',
                plantType: 'basil',
                generation: 8,
                seed: 'operation-cover-pruning',
                position: [0.4, 0.03, 0.45],
                scale: 1.15,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                assetName: 'GardenScissors',
                position: [0.53, 0.32, 0.42],
                rotation: [0.08, -0.72, -0.92],
                scale: 0.21,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'maintenance-pruning',
        operationLabel: 'Održavajuća rezidba',
        outputFileName: 'maintenance-pruning.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.43, 0.3, 0.45],
            zoom: 142,
        },
        plants: [
            {
                id: 'plant',
                plantType: 'lettuce',
                generation: 8,
                seed: 'operation-cover-maintenance-pruning',
                position: [0.38, 0.05, 0.45],
                scale: 0.94,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'crossed-inner-shoot',
                plantType: 'basil',
                generation: 6,
                seed: 'operation-cover-maintenance-crossed-shoot',
                position: [0.53, 0.15, 0.41],
                rotation: [0, 1.25, 0.2],
                scale: 0.56,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                assetName: 'GardenScissors',
                position: [0.54, 0.32, 0.42],
                rotation: [0.06, -0.7, -0.88],
                scale: 0.21,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'pinching',
        operationLabel: 'Pinciranje',
        outputFileName: 'pinching.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.43, 0.32, 0.45],
            zoom: 154,
        },
        plants: [
            {
                id: 'plant',
                plantType: 'basil',
                generation: 8,
                seed: 'operation-cover-pinching',
                position: [0.42, 0.04, 0.45],
                scale: 1.08,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'left-side-shoot',
                plantType: 'basil',
                generation: 4,
                seed: 'operation-cover-pinching-left-shoot',
                position: [0.31, 0.13, 0.47],
                rotation: [0, -0.75, -0.1],
                scale: 0.34,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'right-side-shoot',
                plantType: 'basil',
                generation: 4,
                seed: 'operation-cover-pinching-right-shoot',
                position: [0.54, 0.13, 0.42],
                rotation: [0, 0.8, 0.1],
                scale: 0.34,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                assetName: 'GardenScissors',
                position: [0.5, 0.35, 0.42],
                rotation: [0.06, -0.72, -0.88],
                scale: 0.2,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'rejuvenation-pruning',
        operationLabel: 'Pomlađujuća rezidba',
        outputFileName: 'rejuvenation-pruning.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.43, 0.3, 0.45],
            zoom: 138,
        },
        assets: [
            {
                assetName: 'DeadTreeStump',
                position: [0.36, 0.03, 0.45],
                rotation: [0, -0.45, 0],
                scale: 0.36,
            },
            {
                assetName: 'GardenScissors',
                position: [0.49, 0.29, 0.42],
                rotation: [0.05, -0.68, -0.86],
                scale: 0.21,
            },
        ],
        plants: [
            {
                id: 'fresh-shoot',
                plantType: 'basil',
                generation: 5,
                seed: 'operation-cover-rejuvenation-fresh-shoot',
                position: [0.48, 0.07, 0.43],
                rotation: [0, 0.7, 0],
                scale: 0.48,
                showFlowers: false,
                showProduce: false,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'thinning',
        operationLabel: 'Prorijeđivanje',
        outputFileName: 'thinning.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.42, 0.18, 0.45],
            zoom: 176,
        },
        plants: [
            {
                id: 'center-seedling',
                plantType: 'lettuce',
                generation: 4,
                seed: 'operation-cover-thinning-center',
                position: [0.43, 0.04, 0.44],
                scale: 0.72,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'left-seedling',
                plantType: 'lettuce',
                generation: 3,
                seed: 'operation-cover-thinning-left',
                position: [0.31, 0.03, 0.47],
                rotation: [0, -0.45, 0],
                scale: 0.48,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'right-seedling',
                plantType: 'basil',
                generation: 4,
                seed: 'operation-cover-thinning-right',
                position: [0.54, 0.03, 0.42],
                rotation: [0, 0.45, 0],
                scale: 0.5,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'removed-seedling',
                plantType: 'basil',
                generation: 4,
                seed: 'operation-cover-thinning-removed',
                position: [0.24, 0.02, 0.57],
                rotation: [1.05, -0.4, -0.45],
                scale: 0.46,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                assetName: 'GardenScissors',
                position: [0.33, 0.16, 0.43],
                rotation: [0.08, -0.68, -0.9],
                scale: 0.13,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'hygiene-pruning',
        operationLabel: 'Sanitarna rezidba',
        outputFileName: 'hygiene-pruning.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.43, 0.34, 0.45],
            zoom: 138,
        },
        plants: [
            {
                id: 'plant',
                plantType: 'tomato',
                generation: 7,
                seed: 'operation-cover-hygiene-pruning',
                position: [0.37, -0.03, 0.45],
                scale: 0.8,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                id: 'damaged-branch',
                assetName: 'PestBugKit',
                visibleNodeNames: pestBugLeafDamageNodes,
                position: [0.52, 0.33, 0.41],
                rotation: [0.12, -0.2, -0.35],
                scale: 0.32,
            },
            {
                assetName: 'GardenScissors',
                position: [0.61, 0.39, 0.4],
                rotation: [0.05, -0.7, -0.9],
                scale: 0.21,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'decapitation',
        operationLabel: 'Dekapitacija',
        outputFileName: 'decapitation.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.42, 0.42, 0.45],
            zoom: 132,
        },
        plants: [
            {
                id: 'lower-stem',
                plantType: 'tomato',
                generation: 6,
                seed: 'operation-cover-decapitation-lower',
                position: [0.36, -0.03, 0.45],
                scale: 0.8,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'separated-top',
                plantType: 'tomato',
                generation: 5,
                seed: 'operation-cover-decapitation-top',
                position: [0.48, 0.62, 0.42],
                rotation: [0.42, 0.55, 0.38],
                scale: 0.5,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                assetName: 'GardenScissors',
                position: [0.49, 0.48, 0.41],
                rotation: [0.05, -0.66, -0.88],
                scale: 0.22,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'removeFlowers',
        operationLabel: 'Uklanjanje cvijetova',
        outputFileName: 'removeFlowers.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.43, 0.27, 0.45],
            zoom: 150,
        },
        assets: [
            {
                id: 'flowering-plant',
                assetName: 'GardenFlower',
                position: [0.36, 0.02, 0.45],
                rotation: [0, -0.28, 0],
                scale: 0.48,
            },
            {
                id: 'removed-flower-head',
                assetName: 'GardenFlower',
                visibleNodeNames: gardenFlowerHeadNodes,
                position: [0.58, 0.07, 0.54],
                rotation: [0.9, 0.4, -0.25],
                scale: 0.36,
            },
            {
                assetName: 'GardenScissors',
                position: [0.49, 0.29, 0.4],
                rotation: [0.05, -0.68, -0.9],
                scale: 0.17,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'removeFlowersMaintenance',
        operationLabel: 'Uklanjanje suvišnih cvijetova',
        outputFileName: 'removeFlowersMaintenance.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.45, 0.3, 0.45],
            zoom: 150,
        },
        assets: [
            {
                id: 'flower-left',
                assetName: 'GardenFlower',
                position: [0.34, 0.02, 0.47],
                rotation: [0, -0.45, 0],
                scale: 0.42,
            },
            {
                id: 'flower-center',
                assetName: 'GardenFlower',
                position: [0.46, 0.02, 0.43],
                rotation: [0, 0.18, 0],
                scale: 0.46,
            },
            {
                id: 'flower-right',
                assetName: 'GardenFlower',
                position: [0.57, 0.02, 0.48],
                rotation: [0, 0.45, 0],
                scale: 0.38,
            },
            {
                id: 'removed-flower-head',
                assetName: 'GardenFlower',
                visibleNodeNames: gardenFlowerHeadNodes,
                position: [0.6, 0.09, 0.57],
                rotation: [0.95, 0.4, -0.28],
                scale: 0.34,
            },
            {
                assetName: 'GardenScissors',
                position: [0.54, 0.3, 0.4],
                rotation: [0.05, -0.68, -0.9],
                scale: 0.17,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'green-pruning',
        operationLabel: 'Zelena rezidba',
        outputFileName: 'green-pruning.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.43, 0.29, 0.45],
            zoom: 148,
        },
        plants: [
            {
                id: 'lush-plant',
                plantType: 'lettuce',
                generation: 8,
                seed: 'operation-cover-green-pruning',
                position: [0.37, 0.05, 0.45],
                scale: 0.92,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'soft-side-growth',
                plantType: 'basil',
                generation: 6,
                seed: 'operation-cover-green-pruning-side-growth',
                position: [0.53, 0.13, 0.41],
                rotation: [0, 0.9, 0.12],
                scale: 0.54,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                assetName: 'GardenScissors',
                position: [0.58, 0.31, 0.4],
                rotation: [0.05, -0.68, -0.88],
                scale: 0.2,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'plantRemoval',
        operationLabel: 'Uklanjanje biljke',
        outputFileName: 'plantRemoval.webp',
        camera: {
            position: [2.5, 2.1, 4.8],
            target: [0.43, 0.27, 0.45],
            zoom: 144,
        },
        plants: [
            {
                id: 'tilted-plant',
                plantType: 'basil',
                generation: 7,
                seed: 'operation-cover-plant-removal',
                position: [0.36, 0.11, 0.43],
                rotation: [0.38, 0.2, -0.58],
                scale: 0.68,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                id: 'empty-hole',
                assetName: 'MulchWood',
                position: [0.56, 0.02, 0.55],
                rotation: [0.18, 0.5, -0.08],
                scale: 0.18,
            },
            {
                id: 'root-left',
                assetName: 'Stick',
                position: [0.43, 0.05, 0.47],
                rotation: [0.75, 0.15, -0.6],
                scale: [0.035, 0.15, 0.035],
            },
            {
                id: 'root-right',
                assetName: 'Stick',
                position: [0.48, 0.05, 0.43],
                rotation: [0.75, -0.45, 0.42],
                scale: [0.035, 0.14, 0.035],
            },
            {
                id: 'root-front',
                assetName: 'Stick',
                position: [0.46, 0.03, 0.51],
                rotation: [0.95, 0.28, 0.05],
                scale: [0.035, 0.13, 0.035],
            },
            {
                assetName: 'GardenScissors',
                position: [0.58, 0.25, 0.4],
                rotation: [0.05, -0.68, -0.9],
                scale: 0.17,
            },
        ],
        showBackground: false,
    },
] satisfies readonly OperationCoverRecipe[];

export const bedMaintenanceOperationCoverRecipes = [
    {
        operationId: 'riasedBedCleanup',
        operationLabel: 'Čišćenje gredice',
        outputFileName: 'riasedBedCleanup.webp',
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
                id: 'swept-weeds',
                assetName: 'GardenFlower',
                visibleNodeNames: gardenFlowerLeafNodes,
                position: [0.26, 0.1, 0.31],
                rotation: [0.6, -0.4, -0.7],
                scale: 0.2,
            },
            {
                id: 'loose-hay',
                assetName: 'MulchHey',
                position: [0.3, 0.08, 0.36],
                rotation: [0.1, 0.35, -0.15],
                scale: 0.14,
            },
            {
                id: 'loose-stick',
                assetName: 'Stick',
                position: [0.25, 0.09, 0.42],
                rotation: [0.2, 0.45, -1.15],
                scale: [0.04, 0.2, 0.04],
            },
            {
                assetName: 'FieldworkClipboard',
                position: [0.64, 0.22, 0.32],
                rotation: [0.18, -0.55, -0.22],
                scale: 0.16,
            },
        ],
        plants: [
            {
                id: 'corner-weed',
                plantType: 'basil',
                generation: 4,
                seed: 'operation-cover-raised-bed-cleanup-weed',
                position: [0.22, 0.08, 0.37],
                rotation: [0, -0.6, -0.2],
                scale: 0.36,
                showFlowers: false,
                showProduce: false,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'hillingPlant',
        operationLabel: 'Okopavanje',
        outputFileName: 'hillingPlant.webp',
        camera: {
            position: [2.8, 2.2, 5],
            target: [0.45, 0.25, 0.45],
            zoom: 140,
        },
        plants: [
            {
                id: 'plant',
                plantType: 'tomato',
                generation: 7,
                seed: 'operation-cover-hilling-plant',
                position: [0.41, 0.04, 0.45],
                scale: 0.98,
                showFlowers: false,
                showProduce: false,
            },
        ],
        assets: [
            {
                assetName: 'RaisedBed',
                visibleNodeNames: raisedBedCompactNodes,
                position: [0.45, -0.06, 0.45],
                rotation: [0, 0.72, 0],
                scale: 0.38,
            },
            {
                id: 'soil-mound-left',
                assetName: 'MulchWood',
                position: [0.36, 0.08, 0.48],
                rotation: [0.12, 0.45, -0.08],
                scale: [0.16, 0.08, 0.14],
            },
            {
                id: 'soil-mound-right',
                assetName: 'MulchWood',
                position: [0.47, 0.08, 0.43],
                rotation: [0.12, -0.35, 0.08],
                scale: [0.16, 0.08, 0.14],
            },
            {
                id: 'soil-mound-front',
                assetName: 'MulchWood',
                position: [0.42, 0.075, 0.56],
                rotation: [0.14, 0.95, -0.08],
                scale: [0.17, 0.08, 0.13],
            },
            {
                id: 'soil-mound-back',
                assetName: 'MulchWood',
                position: [0.42, 0.085, 0.39],
                rotation: [0.12, -0.95, 0.06],
                scale: [0.14, 0.07, 0.12],
            },
            {
                id: 'shovel',
                assetName: 'ShovelSmall',
                position: [0.57, 0.12, 0.44],
                rotation: [0.22, -0.95, -0.78],
                scale: 0.2,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'pullingWeedsRaisedBed',
        operationLabel: 'Uklanjanje korova - gredica',
        outputFileName: 'pullingWeedsRaisedBed.webp',
        camera: {
            position: [2.8, 2.2, 5],
            target: [0.45, 0.24, 0.45],
            zoom: 120,
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
                id: 'pulled-weeds-front',
                assetName: 'GardenFlower',
                visibleNodeNames: gardenFlowerLeafNodes,
                position: [0.57, 0.1, 0.58],
                rotation: [0.65, 0.25, -0.95],
                scale: 0.2,
            },
            {
                id: 'pulled-weeds-side',
                assetName: 'GardenFlower',
                visibleNodeNames: gardenFlowerLeafNodes,
                position: [0.66, 0.1, 0.51],
                rotation: [0.62, -0.45, 0.9],
                scale: 0.18,
            },
        ],
        plants: [
            {
                id: 'weed-left-front',
                plantType: 'basil',
                generation: 6,
                seed: 'operation-cover-weeds-bed-left-front',
                position: [0.3, 0.11, 0.39],
                rotation: [0, -0.45, -0.12],
                scale: 0.55,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'weed-left-back',
                plantType: 'basil',
                generation: 5,
                seed: 'operation-cover-weeds-bed-left-back',
                position: [0.39, 0.11, 0.44],
                rotation: [0, 0.25, 0.08],
                scale: 0.52,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'weed-left-corner',
                plantType: 'basil',
                generation: 4,
                seed: 'operation-cover-weeds-bed-left-corner',
                position: [0.31, 0.11, 0.54],
                rotation: [0, 0.65, -0.1],
                scale: 0.44,
                showFlowers: false,
                showProduce: false,
            },
        ],
        showBackground: false,
    },
    {
        operationId: 'pullingWeedsPlant',
        operationLabel: 'Uklanjanje korova - biljka',
        outputFileName: 'pullingWeedsPlant.webp',
        camera: {
            position: [2.6, 2.1, 4.8],
            target: [0.43, 0.27, 0.45],
            zoom: 148,
        },
        assets: [
            {
                assetName: 'RaisedBed',
                visibleNodeNames: raisedBedCompactNodes,
                position: [0.45, -0.06, 0.45],
                rotation: [0, 0.72, 0],
                scale: 0.34,
            },
            {
                id: 'pulled-weeds-right',
                assetName: 'GardenFlower',
                visibleNodeNames: gardenFlowerLeafNodes,
                position: [0.58, 0.1, 0.53],
                rotation: [0.72, -0.55, 0.95],
                scale: 0.2,
            },
            {
                id: 'pulled-weeds-front',
                assetName: 'GardenFlower',
                visibleNodeNames: gardenFlowerLeafNodes,
                position: [0.52, 0.1, 0.6],
                rotation: [0.7, 0.28, -0.95],
                scale: 0.18,
            },
        ],
        plants: [
            {
                id: 'target-plant',
                plantType: 'tomato',
                generation: 7,
                seed: 'operation-cover-hilling-plant',
                position: [0.42, 0.04, 0.45],
                scale: 0.86,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'base-weed-left',
                plantType: 'basil',
                generation: 4,
                seed: 'operation-cover-weeding-plant-left',
                position: [0.31, 0.08, 0.47],
                rotation: [0, -0.35, -0.08],
                scale: 0.38,
                showFlowers: false,
                showProduce: false,
            },
            {
                id: 'base-weed-front',
                plantType: 'basil',
                generation: 3,
                seed: 'operation-cover-weeding-plant-front',
                position: [0.36, 0.08, 0.58],
                rotation: [0, 0.5, 0.1],
                scale: 0.34,
                showFlowers: false,
                showProduce: false,
            },
        ],
        showBackground: false,
    },
] satisfies readonly OperationCoverRecipe[];

export const operationCoverRecipes = [
    ...liquidPreparationOperationCoverRecipes,
    ...waterOperationCoverRecipes,
    ...harvestOperationCoverRecipes,
    ...inventoryOperationCoverRecipes,
    ...cuttingOperationCoverRecipes,
    ...bedMaintenanceOperationCoverRecipes,
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
