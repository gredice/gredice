type FieldOperationAvailability = {
    attributes: {
        application?: string | null;
        appliesToAllTargets?: boolean | null;
    };
};

export function isFieldOperationAvailable(
    operation: FieldOperationAvailability,
    hasPlantTarget: boolean,
) {
    return (
        operation.attributes.application === 'plant' &&
        (hasPlantTarget || operation.attributes.appliesToAllTargets === true)
    );
}
