import type { LSystemGenerationTask } from './l-system-worker-types';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from './plant-definitions';
import type { PlantLodLevel } from './plantLod';

interface GeneratedPlantLodTaskInstance {
    generation: number;
    seed: string;
}

export function buildGeneratedPlantLodTasks(
    definition: PlantDefinition,
    instances: readonly GeneratedPlantLodTaskInstance[],
    lodLevel: PlantLodLevel,
): LSystemGenerationTask[] {
    if (lodLevel !== 'near') {
        return [];
    }

    return instances.map((instance) => ({
        axiom: definition.axiom,
        iterations: Math.ceil(
            Math.min(MAX_PLANT_GENERATION, Math.max(0, instance.generation)),
        ),
        rules: definition.rules,
        seed: instance.seed,
    }));
}
