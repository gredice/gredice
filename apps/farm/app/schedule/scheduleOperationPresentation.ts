import type { EntityStandardized } from '@gredice/storage';
import { getRecommendedPlantCountPerField } from './schedulePlantingPresentation';

export const SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID = 593;

export function buildGreenhouseTransplantingOperationLabel({
    operationEntityId,
    operationLabel,
    plantSort,
    sowingLocation,
}: {
    operationEntityId: number;
    operationLabel: string;
    plantSort: EntityStandardized | null | undefined;
    sowingLocation: string | null | undefined;
}) {
    if (
        operationEntityId !== SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID ||
        sowingLocation !== 'greenhouse' ||
        !plantSort
    ) {
        return null;
    }

    const plantName = plantSort.information?.name?.trim() || 'Nepoznata biljka';
    const recommendedPlantCount = getRecommendedPlantCountPerField(plantSort);
    const transplantInstruction = recommendedPlantCount
        ? `presaditi ${recommendedPlantCount.toString()} ${getTransplantPlantNoun(recommendedPlantCount)} u polje`
        : 'broj biljaka za presađivanje nije zabilježen';

    return `${operationLabel}: ${plantName} · ${transplantInstruction}`;
}

function getTransplantPlantNoun(count: number) {
    if (count === 1) {
        return 'biljku';
    }
    if (count >= 2 && count <= 4) {
        return 'biljke';
    }
    return 'biljaka';
}
