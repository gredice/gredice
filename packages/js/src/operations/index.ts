type PlantOperationApplicability = {
    attributes: {
        application?: string | null;
        appliesToAllTargets?: boolean | null;
    };
    information: {
        name: string;
    };
};

export function isOperationApplicableToPlant(
    operation: PlantOperationApplicability,
    linkedOperationNames: ReadonlySet<string>,
) {
    if (operation.attributes.application !== 'plant') {
        return false;
    }

    return (
        operation.attributes.appliesToAllTargets === true ||
        linkedOperationNames.has(operation.information.name)
    );
}
