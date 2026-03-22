import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from './plant-definition-types';
import { plantTypes } from './plant-presets';

interface InGamePlantRuntimeConfig {
    aliases: string[];
    growthMultiplier: number;
    instanceScale: number;
    plantType: keyof typeof plantTypes;
}

export interface ResolvedInGamePlantPreset {
    definition: PlantDefinition;
    growthMultiplier: number;
    instanceScale: number;
    plantType: keyof typeof plantTypes;
}

function createRuntimeConfig(
    plantType: keyof typeof plantTypes,
    growthMultiplier: number,
    instanceScale: number,
    aliases: string[] = [],
): InGamePlantRuntimeConfig {
    return {
        aliases,
        growthMultiplier,
        instanceScale,
        plantType,
    };
}

const inGamePlantRuntimeConfigs = {
    strawberry: createRuntimeConfig('strawberry', 1.02, 0.28, ['jagoda']),
    blueberry: createRuntimeConfig('blueberry', 0.92, 0.34, ['borovnica']),
    raspberry: createRuntimeConfig('raspberry', 0.98, 0.34, ['malina']),
    tomato: createRuntimeConfig('tomato', 1, 0.34, [
        'rajcica',
        'rajčica',
        'paradajz',
        'cherry tomato',
        'rajcica cherry',
    ]),
    bellpepper: createRuntimeConfig('bellpepper', 0.96, 0.32, [
        'paprika',
        'pepper',
        'bell pepper',
        'slatka paprika',
    ]),
    eggplant: createRuntimeConfig('eggplant', 0.94, 0.34, [
        'patlidzan',
        'patlidžan',
        'aubergine',
    ]),
    artichoke: createRuntimeConfig('artichoke', 0.88, 0.36, ['artičoka']),
    okra: createRuntimeConfig('okra', 0.92, 0.3, ['bamija']),
    cucumber: createRuntimeConfig('cucumber', 1.04, 0.34, [
        'krastavac',
        'krastavci',
    ]),
    zucchini: createRuntimeConfig('zucchini', 0.94, 0.38, [
        'tikvica',
        'tikvice',
        'courgette',
    ]),
    pumpkin: createRuntimeConfig('pumpkin', 0.86, 0.4, ['tikva', 'bundeva']),
    melon: createRuntimeConfig('melon', 0.88, 0.38, ['dinja']),
    carrot: createRuntimeConfig('carrot', 0.98, 0.28, ['mrkva']),
    beet: createRuntimeConfig('beet', 0.92, 0.3, ['cikla']),
    radish: createRuntimeConfig('radish', 1.12, 0.24, ['rotkvica', 'rotkvice']),
    turnip: createRuntimeConfig('turnip', 0.94, 0.28, ['repa']),
    onion: createRuntimeConfig('onion', 0.96, 0.28, ['luk']),
    garlic: createRuntimeConfig('garlic', 0.92, 0.24, ['češnjak', 'cesnjak']),
    leek: createRuntimeConfig('leek', 0.98, 0.28, ['poriluk', 'praziluk']),
    chives: createRuntimeConfig('chives', 1.04, 0.22, ['vlasac', 'luk vlasac']),
    swisschard: createRuntimeConfig('swisschard', 0.92, 0.32, [
        'blitva',
        'mangold',
    ]),
    celery: createRuntimeConfig('celery', 0.94, 0.3, ['celer']),
    lettuce: createRuntimeConfig('lettuce', 1.08, 0.28, ['salata']),
    spinach: createRuntimeConfig('spinach', 1.08, 0.26, ['špinat', 'spinat']),
    arugula: createRuntimeConfig('arugula', 1.1, 0.24, ['rukola', 'rocket']),
    mache: createRuntimeConfig('mache', 1.08, 0.22, [
        'matovilac',
        'corn salad',
    ]),
    basil: createRuntimeConfig('basil', 1.02, 0.24, ['bosiljak']),
    dill: createRuntimeConfig('dill', 1.04, 0.24, ['kopar']),
    coriander: createRuntimeConfig('coriander', 1, 0.24, [
        'korijander',
        'cilantro',
    ]),
    lovage: createRuntimeConfig('lovage', 0.92, 0.26, ['ljupčac', 'ljupcac']),
    oregano: createRuntimeConfig('oregano', 0.96, 0.22, ['origano']),
    parsley: createRuntimeConfig('parsley', 1, 0.24, ['peršin', 'persin']),
    thyme: createRuntimeConfig('thyme', 0.92, 0.2, ['timijan']),
    broadbean: createRuntimeConfig('broadbean', 0.94, 0.32, [
        'bob',
        'fava bean',
    ]),
    bean: createRuntimeConfig('bean', 0.98, 0.32, ['grah']),
    pea: createRuntimeConfig('pea', 1.02, 0.28, ['grašak', 'grasak']),
    greenbean: createRuntimeConfig('greenbean', 1, 0.3, ['mahuna']),
    broccoli: createRuntimeConfig('broccoli', 0.92, 0.34, ['brokula']),
    cauliflower: createRuntimeConfig('cauliflower', 0.92, 0.34, [
        'cvjetača',
        'cvjetaca',
    ]),
    kale: createRuntimeConfig('kale', 0.94, 0.34, ['kelj']),
    kohlrabi: createRuntimeConfig('kohlrabi', 0.92, 0.3, ['koraba']),
    cabbage: createRuntimeConfig('cabbage', 0.9, 0.36, ['kupus']),
    collard: createRuntimeConfig('collard', 0.9, 0.34, ['raštika', 'rastika']),
    fennel: createRuntimeConfig('fennel', 0.94, 0.3, ['komorač', 'komorac']),
    lemongrass: createRuntimeConfig('lemongrass', 0.92, 0.24, [
        'limunska trava',
    ]),
    wheatgrass: createRuntimeConfig('wheatgrass', 0.98, 0.2, [
        'pšenična trava',
        'psenicna trava',
    ]),
    ornamentalgrass: createRuntimeConfig('ornamentalgrass', 0.84, 0.26, [
        'ukrasna trava',
    ]),
    figtree: createRuntimeConfig('figtree', 0.72, 0.42, ['smokva']),
    olivetree: createRuntimeConfig('olivetree', 0.68, 0.4, ['maslina']),
    youngappletree: createRuntimeConfig('youngappletree', 0.72, 0.42, [
        'mlada jabuka',
        'jabuka',
    ]),
} satisfies Record<string, InGamePlantRuntimeConfig>;

function normalizePlantLabel(value: string) {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function getRuntimeAliases(config: InGamePlantRuntimeConfig) {
    return [
        config.plantType,
        plantTypes[config.plantType].name,
        ...config.aliases,
    ].map(normalizePlantLabel);
}

export function resolveInGamePlantPreset(
    labels: Array<string | null | undefined>,
): ResolvedInGamePlantPreset | null {
    const normalizedLabels = labels
        .filter((label): label is string => Boolean(label))
        .map(normalizePlantLabel);

    for (const config of Object.values(inGamePlantRuntimeConfigs)) {
        const runtimeAliases = getRuntimeAliases(config);
        const matches = runtimeAliases.some((alias) =>
            normalizedLabels.some(
                (label) =>
                    label === alias ||
                    label.includes(alias) ||
                    alias.includes(label),
            ),
        );

        if (matches) {
            return {
                definition: plantTypes[config.plantType],
                growthMultiplier: config.growthMultiplier,
                instanceScale: config.instanceScale,
                plantType: config.plantType,
            };
        }
    }

    return null;
}

export function getPlantLifecycleWindowDays({
    germinationWindowMax,
    growthWindowMax,
    harvestWindowMax,
}: {
    germinationWindowMax?: number;
    growthWindowMax?: number;
    harvestWindowMax?: number;
}) {
    return Math.max(
        1,
        (germinationWindowMax ?? 0) +
            (growthWindowMax ?? 0) +
            (harvestWindowMax ?? 0),
    );
}

export function calculateInGamePlantGeneration({
    currentTime,
    sowDate,
    lifecycleWindowDays,
    growthMultiplier,
}: {
    currentTime: Date;
    sowDate: string;
    lifecycleWindowDays: number;
    growthMultiplier: number;
}) {
    const elapsedDays = Math.max(
        0,
        (currentTime.getTime() - new Date(sowDate).getTime()) /
            (1000 * 60 * 60 * 24),
    );

    return Math.min(
        MAX_PLANT_GENERATION,
        (elapsedDays / Math.max(lifecycleWindowDays, 1)) *
            MAX_PLANT_GENERATION *
            growthMultiplier,
    );
}
