export type OperationTargetScope = 'farm' | 'garden' | 'raisedBed' | 'plant';

type OperationLocation = {
    farmId?: number | null;
    gardenId?: number | null;
    raisedBedId?: number | null;
    raisedBedFieldId?: number | null;
    plantingId?: number | null;
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

export function operationTargetScope(
    operation: OperationLocation,
): OperationTargetScope | undefined {
    if (operation.plantingId || operation.raisedBedFieldId) {
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
