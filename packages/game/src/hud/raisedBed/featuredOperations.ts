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

export type PlantFieldStatus =
    | 'new'
    | 'planned'
    | 'sowed'
    | 'sprouted'
    | 'notSprouted'
    | 'ready'
    | 'harvested'
    | 'died'
    | 'removed';

export const PLANT_STAGE_LABELS: Record<PlantStageName, string> = {
    sowing: 'Sijanje',
    soilPreparation: 'Priprema tla',
    planting: 'Sadnja',
    growth: 'Rast',
    maintenance: 'Održavanje',
    watering: 'Zalijevanje',
    flowering: 'Cvjetanje',
    harvest: 'Berba',
    storage: 'Skladištenje',
} as const;

export const PLANT_STATUS_STAGE_SEQUENCE: Record<
    PlantFieldStatus,
    PlantStageName[]
> = {
    new: ['soilPreparation', 'sowing'],
    planned: ['soilPreparation', 'sowing', 'planting'],
    sowed: ['sowing', 'watering'],
    sprouted: ['maintenance', 'growth', 'watering'],
    notSprouted: ['sowing', 'maintenance'],
    ready: ['harvest', 'storage'],
    harvested: ['storage', 'maintenance'],
    died: ['maintenance', 'soilPreparation'],
    removed: ['maintenance', 'maintenance'],
} as const;

export const FEATURED_OPERATIONS_BY_STAGE: Partial<
    Record<PlantStageName, string[]>
> = {
    // Populate with operation "information.name" values to ensure they are
    // always highlighted for a particular stage. When an array is empty or no
    // value matches loaded operations the UI falls back to the first few
    // operations for that stage.
    harvest: [],
    growth: [],
    maintenance: [],
    planting: [],
    sowing: [],
    soilPreparation: [],
    storage: [],
    watering: [],
    flowering: [],
} as const;

export const DEFAULT_FEATURED_OPERATION_LIMIT = 4;
