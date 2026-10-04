import type { PlantData, PlantSortData } from '@gredice/client';
import { PLANT_STAGES, type PlantStageName } from '@gredice/js/plants';
import {
    getApplicablePlantOperationStageNames,
    type OperationForStageAvailability,
} from './plantOperationStageAvailability';

export type InformationSection = {
    header: string;
    id: PlantStageName;
    avaialble: boolean;
};

function hasValue(value: unknown): boolean {
    if (value == null) {
        return false;
    }

    if (typeof value === 'number') {
        return !Number.isNaN(value);
    }

    if (typeof value === 'string') {
        return value.trim().length > 0;
    }

    return true;
}

function hasInformationText(value: unknown): boolean {
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function hasSortInformationText(
    sort: PlantSortData | null | undefined,
    section: PlantStageName,
) {
    return hasInformationText(sort?.information[section]);
}

function hasSectionAttributes(
    plant: PlantData,
    section: PlantStageName,
): boolean {
    const attributes = plant.attributes;
    if (!attributes) {
        return false;
    }

    switch (section) {
        case 'sowing':
            return [
                attributes.seedingDistance,
                attributes.seedingDepth,
                attributes.germinationType,
                attributes.gernimationTemperature,
                attributes.germinationWindowMin,
                attributes.germinationWindowMax,
            ].some(hasValue);
        case 'growth':
            return [
                attributes.light,
                attributes.soil,
                attributes.nutrients,
                attributes.growthWindowMin,
                attributes.growthWindowMax,
            ].some(hasValue);
        case 'watering':
            return hasValue(attributes.water);
        case 'harvest':
            return [
                attributes.harvestWindowMin,
                attributes.harvestWindowMax,
                attributes.yieldMin,
                attributes.yieldMax,
            ].some(hasValue);
        default:
            return false;
    }
}

export function getPlantInforationSections(
    plant: PlantData,
    sort?: PlantSortData | null,
    operations: readonly OperationForStageAvailability[] = [],
): InformationSection[] {
    const operationStageNames = getApplicablePlantOperationStageNames(
        operations,
        plant.information.operations,
    );

    return PLANT_STAGES.map((stage) => ({
        header: stage.label,
        id: stage.name,
        avaialble:
            hasSortInformationText(sort, stage.name) ||
            hasInformationText(plant.information[stage.name]) ||
            hasSectionAttributes(plant, stage.name) ||
            operationStageNames.has(stage.name),
    }));
}
