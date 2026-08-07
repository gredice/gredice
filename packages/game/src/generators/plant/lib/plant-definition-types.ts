/** Shared appearance and developmental-program types for procedural plants. */

export type VegetableType =
    | 'strawberry'
    | 'blueberry'
    | 'raspberry'
    | 'tomato'
    | 'cucumber'
    | 'bellpepper'
    | 'carrot'
    | 'onion'
    | 'eggplant'
    | 'zucchini'
    | 'pumpkin'
    | 'melon'
    | 'beet'
    | 'radish'
    | 'turnip'
    | 'garlic'
    | 'leek'
    | 'broccoli'
    | 'cauliflower'
    | 'cabbage'
    | 'beanpod'
    | 'peapod'
    | 'artichoke'
    | 'okra'
    | 'fennel'
    | 'kohlrabi';

export type PlantArchitecture =
    | 'clump'
    | 'rosette'
    | 'shrub'
    | 'tree'
    | 'upright'
    | 'vine';

export type PlantAxisHabit =
    | 'basal'
    | 'climbing'
    | 'prostrate'
    | 'upright'
    | 'woody';

export type PlantBranchingPattern =
    | 'alternate'
    | 'forked'
    | 'multi-stem'
    | 'none'
    | 'opposite'
    | 'sympodial';

export type PlantFoliageArrangement =
    | 'alternate'
    | 'fan'
    | 'opposite'
    | 'rosette'
    | 'whorled';

export type PlantFlowerForm =
    | 'cluster'
    | 'pea'
    | 'pom-pom'
    | 'spike'
    | 'star'
    | 'umbel';

export type PlantReproductiveSite =
    | 'axillary'
    | 'spike'
    | 'terminal'
    | 'truss'
    | 'umbel';

export interface PlantDevelopmentPhenology {
    emergenceStart: number;
    maturityGeneration: number;
    senescenceStart?: number;
}

export interface PlantDevelopmentAxes {
    axisCount: number;
    branchCount: number;
    branchLengthScale: number;
    branchNodeCount: number;
    branchPitchDegrees: number;
    branchingPattern: PlantBranchingPattern;
    habit: PlantAxisHabit;
    internodeLengthScale: number;
    mainStemHorizontalScale?: number;
    nodeCount: number;
    pitchDegrees: number;
    spread: number;
}

export interface PlantDevelopmentFoliage {
    arrangement: PlantFoliageArrangement;
    count: number;
    emergenceInterval: number;
    maturityDuration: number;
    petioleLengthScale: number;
    phyllotaxisDegrees: number;
    pitchRangeDegrees: readonly [minimum: number, maximum: number];
    sizeRange: readonly [minimum: number, maximum: number];
}

export interface PlantDevelopmentReproduction {
    flowerStart: number;
    flowersPerSite: number;
    form: PlantFlowerForm;
    fruitStart?: number;
    produceCount: number;
    site: PlantReproductiveSite;
    siteCount: number;
}

export interface PlantDevelopmentStorage {
    aboveSoilFraction: number;
    birthGeneration: number;
    matureGeneration: number;
    sizeScale: number;
}

export interface PlantDevelopmentSpecial {
    runnerCount?: number;
    tendrilCount?: number;
    thornCount?: number;
}

export interface PlantDevelopmentProgram {
    architecture: PlantArchitecture;
    axes: PlantDevelopmentAxes;
    foliage: PlantDevelopmentFoliage;
    phenology: PlantDevelopmentPhenology;
    reproduction: PlantDevelopmentReproduction;
    special?: PlantDevelopmentSpecial;
    storage?: PlantDevelopmentStorage;
    variability: number;
}

export type PlantLeafType =
    | 'round'
    | 'oval'
    | 'heart'
    | 'serrated'
    | 'compound'
    | 'ruffled'
    | 'lobed'
    | 'strap'
    | 'tubular'
    | 'lanceolate'
    | 'trifoliate'
    | 'pinnate'
    | 'feathery'
    | 'palmate';

export interface ThornDefinition {
    enabled: boolean;
    color: string;
    size: number;
    density: number;
}

export const defaultThornDefinition: ThornDefinition = {
    enabled: false,
    color: '#8c6a3d',
    size: 0.08,
    density: 2,
};

export interface PlantDefinition {
    key: string;
    name: string;
    development: PlantDevelopmentProgram;
    height: number;
    stem: {
        color: string;
        radius: number;
        radiusDecay: number;
        minRadius: number;
        surface?: 'smooth' | 'bark';
        detailColor?: string;
        detailStrength?: number;
        detailScale?: number;
    };
    leaf: {
        color: string;
        size: number;
        type: PlantLeafType;
    };
    flower: {
        enabled: boolean;
        color: string;
        size: number;
    };
    vegetable: {
        enabled: boolean;
        type: VegetableType;
        baseSize: number;
    };
    thorn?: ThornDefinition;
}

export const MAX_PLANT_GENERATION = 12;

export const vegetableTypeOptions: { value: VegetableType; label: string }[] = [
    { value: 'strawberry', label: 'Jagoda' },
    { value: 'blueberry', label: 'Borovnica' },
    { value: 'raspberry', label: 'Malina' },
    { value: 'tomato', label: 'Rajčica' },
    { value: 'cucumber', label: 'Krastavac' },
    { value: 'bellpepper', label: 'Paprika' },
    { value: 'carrot', label: 'Mrkva' },
    { value: 'onion', label: 'Luk' },
    { value: 'eggplant', label: 'Patlidžan' },
    { value: 'zucchini', label: 'Tikvice' },
    { value: 'pumpkin', label: 'Tikva' },
    { value: 'melon', label: 'Dinja' },
    { value: 'beet', label: 'Cikla' },
    { value: 'radish', label: 'Rotkvica' },
    { value: 'turnip', label: 'Repa' },
    { value: 'garlic', label: 'Češnjak' },
    { value: 'leek', label: 'Poriluk' },
    { value: 'broccoli', label: 'Brokula' },
    { value: 'cauliflower', label: 'Cvjetača' },
    { value: 'cabbage', label: 'Kupus' },
    { value: 'beanpod', label: 'Mahuna' },
    { value: 'peapod', label: 'Grašak' },
    { value: 'artichoke', label: 'Artičoka' },
    { value: 'okra', label: 'Bamija' },
    { value: 'fennel', label: 'Komorač' },
    { value: 'kohlrabi', label: 'Koraba' },
];
