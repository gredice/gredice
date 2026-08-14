import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from '../../generators/plant/lib/plant-definitions';

const visibleRaisedBedPlantStatuses = new Set([
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'ready',
    'harvested',
]);

const lifecycleStageInset = 0.05;
const firstStageGrowth = 0.35;

export type RaisedBedPlantVisualStage = {
    flowerGrowth: number;
    fruitGrowth: number;
    generation: number;
    key:
        | 'default'
        | 'flowering'
        | 'fruiting'
        | 'harvested'
        | 'mature'
        | 'sprouted';
    showFlowers: boolean;
    showProduce: boolean;
};

function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(Math.max(value, minimum), maximum);
}

function getProduceWindow(plantDefinition: PlantDefinition) {
    const { reproduction, storage } = plantDefinition.development;
    const start = storage?.birthGeneration ?? reproduction.fruitStart;
    if (start === undefined) {
        return null;
    }

    return {
        mature: storage?.matureGeneration ?? start + 2.2,
        start,
    };
}

export function resolveRaisedBedPlantVisualStage({
    generation,
    harvestedVisual = false,
    plantDefinition,
    plantStatus,
}: {
    generation: number;
    harvestedVisual?: boolean | null;
    plantDefinition: PlantDefinition;
    plantStatus?: string | null;
}): RaisedBedPlantVisualStage {
    const { phenology, reproduction } = plantDefinition.development;
    const produceWindow = getProduceWindow(plantDefinition);

    if (harvestedVisual || plantStatus === 'harvested') {
        return {
            flowerGrowth: 0.35,
            fruitGrowth: 0.1,
            generation: Math.min(
                MAX_PLANT_GENERATION,
                Math.max(generation * 0.7, phenology.maturityGeneration * 0.7),
            ),
            key: 'harvested',
            showFlowers: true,
            showProduce: false,
        };
    }

    switch (plantStatus) {
        case 'sprouted': {
            const maximumGeneration = Math.max(
                phenology.emergenceStart,
                reproduction.flowerStart - lifecycleStageInset,
            );
            return {
                flowerGrowth: 0,
                fruitGrowth: 0,
                generation: Math.min(generation, maximumGeneration),
                key: 'sprouted',
                showFlowers: false,
                showProduce: false,
            };
        }
        case 'firstFlowers': {
            const maximumGeneration = Math.max(
                reproduction.flowerStart + firstStageGrowth,
                (produceWindow?.start ?? MAX_PLANT_GENERATION) -
                    lifecycleStageInset,
            );
            return {
                flowerGrowth: 1,
                fruitGrowth: 0,
                generation: clamp(
                    generation,
                    reproduction.flowerStart + firstStageGrowth,
                    maximumGeneration,
                ),
                key: 'flowering',
                showFlowers: true,
                showProduce: false,
            };
        }
        case 'firstFruitSet': {
            const produceStart = produceWindow?.start ?? generation;
            const produceMature = produceWindow?.mature ?? generation;
            const maximumGeneration =
                produceStart +
                (produceMature - produceStart) * firstStageGrowth;
            return {
                flowerGrowth: 1,
                fruitGrowth: 1,
                generation: clamp(
                    generation,
                    Math.min(
                        produceStart + firstStageGrowth,
                        maximumGeneration,
                    ),
                    maximumGeneration,
                ),
                key: 'fruiting',
                showFlowers: true,
                showProduce: true,
            };
        }
        case 'ready':
            return {
                flowerGrowth: 1,
                fruitGrowth: 1,
                generation: MAX_PLANT_GENERATION,
                key: 'mature',
                showFlowers: true,
                showProduce: true,
            };
        default:
            return {
                flowerGrowth: 1,
                fruitGrowth: 1,
                generation,
                key: 'default',
                showFlowers: true,
                showProduce: true,
            };
    }
}

export function shouldRenderRaisedBedPlant({
    plantSowDate,
    plantStatus,
}: {
    plantSowDate?: string | null;
    plantStatus?: string | null;
}) {
    return Boolean(
        plantSowDate &&
            plantStatus &&
            visibleRaisedBedPlantStatuses.has(plantStatus),
    );
}
