import {
    PLANT_STAGE_LABELS,
    PLANT_STAGES,
    type PlantStageName,
} from '@gredice/js/plants';

export { PLANT_STAGE_LABELS, PLANT_STAGES, type PlantStageName };

export type PlantFieldStatus =
    | 'new'
    | 'planned'
    | 'pendingVerification'
    | 'sowed'
    | 'sprouted'
    | 'firstFlowers'
    | 'firstFruitSet'
    | 'notSprouted'
    | 'ready'
    | 'harvested'
    | 'died'
    | 'removed';

export const PLANT_STATUS_STAGE_SEQUENCE: Record<
    PlantFieldStatus,
    PlantStageName[]
> = {
    new: ['soilPreparation', 'sowing'],
    planned: ['soilPreparation', 'sowing', 'planting'],
    pendingVerification: ['sowing', 'watering'],
    sowed: ['sowing', 'watering'],
    sprouted: ['maintenance', 'growth', 'watering'],
    firstFlowers: ['flowering', 'maintenance', 'watering'],
    firstFruitSet: ['growth', 'watering', 'harvest'],
    notSprouted: ['sowing', 'maintenance'],
    ready: ['harvest', 'storage'],
    harvested: ['storage'],
    died: ['storage'],
    removed: ['maintenance', 'maintenance'],
} as const;

export function isPlantFieldStatus(
    status: string | null | undefined,
): status is PlantFieldStatus {
    return typeof status === 'string' && status in PLANT_STATUS_STAGE_SEQUENCE;
}

export function shouldShowPlantOperationRecommendations(
    plantStatus: PlantFieldStatus | undefined,
) {
    return plantStatus !== 'notSprouted';
}

export function getPlantOperationRecommendationStages(
    plantStatus: PlantFieldStatus | undefined,
) {
    if (!plantStatus || !shouldShowPlantOperationRecommendations(plantStatus)) {
        return undefined;
    }

    return PLANT_STATUS_STAGE_SEQUENCE[plantStatus];
}

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
    storage: ['plantRemoval'],
    watering: [],
    flowering: [],
} as const;

export const DEFAULT_FEATURED_OPERATION_LIMIT = 4;
