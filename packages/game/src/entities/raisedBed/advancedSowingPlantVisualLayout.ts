import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from '../../generators/plant/lib/plant-definitions';
import type { AdvancedSowingGardenPlantingVisual } from '../../hud/raisedBed/advancedSowingGardenVisuals';
import { resolveRaisedBedPlantVisualStage } from './raisedBedPlantVisualStatus';

export type AdvancedSowingWorldPosition = readonly [number, number, number];

export type AdvancedSowingPlantVisualLayout = {
    centroid: AdvancedSowingWorldPosition;
    instancePositions: AdvancedSowingWorldPosition[];
};

const selectedPlantingGenerationFractionByStatus = {
    sprouted: 0.25,
    firstFlowers: 0.55,
    firstFruitSet: 0.72,
    ready: 1,
    harvested: 0.85,
} satisfies Record<string, number>;

const plantSlotStepByPlantsPerAxis = [0, 0, 0.13, 0.09, 0.07];

export function getSelectedPlantingVisualGeneration(
    lifecycleStatus: string | null | undefined,
) {
    if (!lifecycleStatus) {
        return null;
    }

    const fraction = Reflect.get(
        selectedPlantingGenerationFractionByStatus,
        lifecycleStatus,
    );
    return typeof fraction === 'number'
        ? fraction * MAX_PLANT_GENERATION
        : null;
}

export function resolveAdvancedSowingPlantVisualStage({
    lifecycleStatus,
    plantDefinition,
}: {
    lifecycleStatus: string | null | undefined;
    plantDefinition: PlantDefinition;
}) {
    const generation = getSelectedPlantingVisualGeneration(lifecycleStatus);
    if (generation === null) {
        return null;
    }

    return resolveRaisedBedPlantVisualStage({
        generation,
        plantDefinition,
        plantStatus: lifecycleStatus,
    });
}

/**
 * Builds exactly one spatial visual for a selected planting. The membership
 * centers define its footprint centroid, while the persisted density snapshot
 * defines the instances inside that visual. Catalogue spacing is not accepted.
 */
export function buildAdvancedSowingPlantVisualLayout({
    fieldPositionByIndex,
    planting,
}: {
    fieldPositionByIndex: ReadonlyMap<number, AdvancedSowingWorldPosition>;
    planting: Pick<
        AdvancedSowingGardenPlantingVisual,
        'plantCount' | 'plantsPerAxis'
    > & {
        memberships: readonly Pick<
            AdvancedSowingGardenPlantingVisual['memberships'][number],
            'positionIndex'
        >[];
    };
}): AdvancedSowingPlantVisualLayout | null {
    if (
        !Number.isSafeInteger(planting.plantsPerAxis) ||
        planting.plantsPerAxis <= 0 ||
        !Number.isSafeInteger(planting.plantCount) ||
        planting.plantCount !== planting.plantsPerAxis ** 2 ||
        planting.memberships.length === 0
    ) {
        return null;
    }

    const membershipPositions = planting.memberships.flatMap((membership) => {
        const position = fieldPositionByIndex.get(membership.positionIndex);
        return position ? [position] : [];
    });
    if (membershipPositions.length !== planting.memberships.length) {
        return null;
    }

    const totals = membershipPositions.reduce<[number, number, number]>(
        (total, position) => [
            total[0] + position[0],
            total[1] + position[1],
            total[2] + position[2],
        ],
        [0, 0, 0],
    );
    const centroid: AdvancedSowingWorldPosition = [
        totals[0] / membershipPositions.length,
        totals[1] / membershipPositions.length,
        totals[2] / membershipPositions.length,
    ];
    const plantsPerAxis = planting.plantsPerAxis;
    const slotStep =
        plantSlotStepByPlantsPerAxis[plantsPerAxis] ??
        plantSlotStepByPlantsPerAxis.at(-1) ??
        0.07;
    const slotStart = -((plantsPerAxis - 1) * slotStep) / 2;
    const instancePositions = Array.from(
        { length: planting.plantCount },
        (_, index): AdvancedSowingWorldPosition => {
            const row = Math.floor(index / plantsPerAxis);
            const column = index % plantsPerAxis;
            return [
                centroid[0] + row * slotStep + slotStart,
                centroid[1] + 0.02,
                centroid[2] + column * slotStep + slotStart,
            ];
        },
    );

    return { centroid, instancePositions };
}
