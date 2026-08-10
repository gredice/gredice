import { isOperationApplicableToPlant } from '@gredice/js/operations';
import { isRaisedBedFieldOccupied } from '../utils/raisedBedFields';

type RecommendationGarden = {
    id: number;
    raisedBeds: Array<{
        id: number;
        status?: string | null;
        fields: Array<{
            active?: boolean | null;
            plantSortId?: number | null;
            positionIndex: number;
        }>;
    }>;
};

type RecommendationOperation = {
    attributes: {
        application?: string | null;
        appliesToAllTargets?: boolean | null;
    };
    information: { name: string };
};

type RecommendationPlantSort = {
    id: number;
    information: {
        plant: {
            information: {
                operations: Array<{ information: { name: string } }>;
            };
        };
    };
};

type TargetlessOperationRecommendation = {
    gardenId: number;
    raisedBedId: number;
    positionIndex?: number;
};

export function resolveOperationRecommendationTargets<
    Recommendation extends TargetlessOperationRecommendation,
>({
    garden,
    operation,
    plantSorts,
    recommendation,
}: {
    garden: RecommendationGarden | null | undefined;
    operation: RecommendationOperation | undefined;
    plantSorts: RecommendationPlantSort[] | undefined;
    recommendation: Recommendation;
}): Recommendation[] {
    if (
        typeof recommendation.positionIndex === 'number' ||
        operation?.attributes.application !== 'plant' ||
        garden?.id !== recommendation.gardenId ||
        !plantSorts
    ) {
        return [recommendation];
    }

    const raisedBed = garden.raisedBeds.find(
        (candidate) => candidate.id === recommendation.raisedBedId,
    );
    if (raisedBed?.status !== 'active') {
        return [recommendation];
    }

    const plantSortsById = new Map(
        plantSorts.map((plantSort) => [plantSort.id, plantSort]),
    );
    const targets = raisedBed.fields.flatMap((field) => {
        const plantSortId = field.plantSortId;
        if (
            !isRaisedBedFieldOccupied(field) ||
            typeof plantSortId !== 'number'
        ) {
            return [];
        }

        if (operation.attributes.appliesToAllTargets === true) {
            return [{ ...recommendation, positionIndex: field.positionIndex }];
        }

        const plantSort = plantSortsById.get(plantSortId);
        if (!plantSort) {
            return [];
        }

        const linkedOperationNames = new Set(
            plantSort.information.plant.information.operations.map(
                (linkedOperation) => linkedOperation.information.name,
            ),
        );
        if (!isOperationApplicableToPlant(operation, linkedOperationNames)) {
            return [];
        }

        return [{ ...recommendation, positionIndex: field.positionIndex }];
    });

    return targets.length > 0 ? targets : [recommendation];
}
