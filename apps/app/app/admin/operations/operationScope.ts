export type OperationTargetScope = 'farm' | 'garden' | 'raisedBed' | 'plant';

export const ADVANCED_SOWING_PLANT_OPERATION_TARGET_MESSAGE =
    'Radnja za pojedinu biljku nije dostupna na polju s naprednom sjetvom. Odaberi radnju za cijelo polje ili gredicu.';

type OperationLocation = {
    farmId?: number | null;
    gardenId?: number | null;
    raisedBedId?: number | null;
    raisedBedFieldId?: number | null;
};

type OperationDefinition = {
    attributes?: {
        application?: string | null;
    };
};

type RaisedBedPlantingTargetAvailability = {
    configurationSource: string;
    isActive: boolean;
    isDeleted?: boolean;
    memberships: Array<{
        raisedBedFieldId: number;
        isDeleted?: boolean;
    }>;
};

export function activeSelectedPlantingFieldIds(
    plantings: readonly RaisedBedPlantingTargetAvailability[],
) {
    return new Set(
        plantings.flatMap((planting) => {
            if (
                planting.configurationSource !== 'selected' ||
                !planting.isActive ||
                planting.isDeleted
            ) {
                return [];
            }
            return planting.memberships.flatMap((membership) =>
                membership.isDeleted ? [] : [membership.raisedBedFieldId],
            );
        }),
    );
}

export function isAdvancedSowingPlantOperationTargetBlocked(input: {
    application: string | null | undefined;
    hasActiveSelectedPlanting: boolean;
}) {
    return input.application === 'plant' && input.hasActiveSelectedPlanting;
}

export function operationTargetScope(
    operation: OperationLocation,
): OperationTargetScope | undefined {
    if (operation.raisedBedFieldId) {
        return 'plant';
    }

    if (operation.raisedBedId) {
        return 'raisedBed';
    }

    if (operation.gardenId) {
        return 'garden';
    }

    if (operation.farmId) {
        return 'farm';
    }

    return undefined;
}

export function operationApplicationScope(
    application: string | null | undefined,
): OperationTargetScope | undefined {
    if (application === 'farm') {
        return 'farm';
    }

    if (application === 'garden') {
        return 'garden';
    }

    if (application === 'plant') {
        return 'plant';
    }

    if (application) {
        return 'raisedBed';
    }

    return undefined;
}

export function operationDefinitionMatchesTargetScope(
    operation: OperationLocation,
    operationDefinition: OperationDefinition,
) {
    const targetScope = operationTargetScope(operation);
    if (!targetScope) {
        return true;
    }

    return (
        operationApplicationScope(
            operationDefinition.attributes?.application,
        ) === targetScope
    );
}
