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

/**
 * Plant stage configuration - Single source of truth for all plant stages.
 *
 * This constant defines the canonical order, labels, and icon identifiers for all plant stages.
 * It serves as the central definition used across the entire application for:
 * - Operations page stage grouping and ordering
 * - Plant information sections ordering
 * - Stage selection and filtering throughout the UI
 * - Any other plant lifecycle stage representations
 *
 * **Order matters**: The array order defines the logical workflow sequence from
 * soil preparation through to storage. This order is preserved when displaying
 * stages throughout the application.
 *
 * **Properties**:
 * - `name`: Internal identifier (PlantStageName) used in the database and API
 * - `label`: User-facing Croatian label displayed in the UI
 * - `icon`: Icon identifier (currently matches name, reserved for future icon mapping)
 *
 * **Usage Examples**:
 * ```typescript
 * // Get all available stages
 * const stages = PLANT_STAGES;
 *
 * // Filter to only stages present in data
 * const activeStages = PLANT_STAGES.filter(stage =>
 *   myData.some(item => item.stageName === stage.name)
 * );
 *
 * // Map to display labels
 * const labels = PLANT_STAGES.map(stage => stage.label);
 * ```
 *
 * @since 1.0.0
 */
export const PLANT_STAGES = [
    {
        name: 'soilPreparation' as const,
        label: 'Priprema tla',
        icon: 'soilPreparation',
    },
    {
        name: 'sowing' as const,
        label: 'Sijanje',
        icon: 'sowing',
    },
    {
        name: 'planting' as const,
        label: 'Sadnja',
        icon: 'planting',
    },
    {
        name: 'growth' as const,
        label: 'Rast',
        icon: 'growth',
    },
    {
        name: 'maintenance' as const,
        label: 'Održavanje',
        icon: 'maintenance',
    },
    {
        name: 'watering' as const,
        label: 'Zalijevanje',
        icon: 'watering',
    },
    {
        name: 'flowering' as const,
        label: 'Cvjetanje',
        icon: 'flowering',
    },
    {
        name: 'harvest' as const,
        label: 'Berba',
        icon: 'harvest',
    },
    {
        name: 'storage' as const,
        label: 'Skladištenje',
        icon: 'storage',
    },
] as const;

/**
 * @deprecated Use PLANT_STAGES array instead. This will be removed in a future version.
 * Legacy map for backwards compatibility.
 */
export const PLANT_STAGE_LABELS: Record<PlantStageName, string> = {
    soilPreparation: 'Priprema tla',
    sowing: 'Sijanje',
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
    harvested: ['storage'],
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
    storage: ['plantRemoval'],
    watering: [],
    flowering: [],
} as const;

export const DEFAULT_FEATURED_OPERATION_LIMIT = 4;
