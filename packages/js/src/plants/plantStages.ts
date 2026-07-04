export type PlantStageName =
    | 'sowing'
    | 'soilPreparation'
    | 'planting'
    | 'growth'
    | 'maintenance'
    | 'watering'
    | 'flowering'
    | 'harvest'
    | 'storage';

export type PlantStageDefinition = {
    readonly name: PlantStageName;
    readonly label: string;
    readonly icon: PlantStageName;
};

/**
 * Canonical plant lifecycle stages in the public display order.
 */
export const PLANT_STAGES = [
    {
        name: 'soilPreparation',
        label: 'Priprema tla',
        icon: 'soilPreparation',
    },
    {
        name: 'sowing',
        label: 'Sijanje',
        icon: 'sowing',
    },
    {
        name: 'planting',
        label: 'Sadnja',
        icon: 'planting',
    },
    {
        name: 'growth',
        label: 'Rast',
        icon: 'growth',
    },
    {
        name: 'maintenance',
        label: 'Održavanje',
        icon: 'maintenance',
    },
    {
        name: 'watering',
        label: 'Zalijevanje',
        icon: 'watering',
    },
    {
        name: 'flowering',
        label: 'Cvjetanje',
        icon: 'flowering',
    },
    {
        name: 'harvest',
        label: 'Berba',
        icon: 'harvest',
    },
    {
        name: 'storage',
        label: 'Skladištenje',
        icon: 'storage',
    },
] as const satisfies readonly PlantStageDefinition[];

export const PLANT_STAGE_LABELS = {
    soilPreparation: 'Priprema tla',
    sowing: 'Sijanje',
    planting: 'Sadnja',
    growth: 'Rast',
    maintenance: 'Održavanje',
    watering: 'Zalijevanje',
    flowering: 'Cvjetanje',
    harvest: 'Berba',
    storage: 'Skladištenje',
} as const satisfies Record<PlantStageName, string>;
