import { isOperationApplicableToPlant } from '@gredice/js/operations';

export type OperationForStageAvailability = {
    attributes: {
        application?: string | null;
        appliesToAllTargets?: boolean | null;
        internal?: boolean | null;
        stage?: {
            information?: {
                name?: string | null;
            } | null;
        } | null;
    };
    information: {
        name: string;
    };
};

export function getApplicablePlantOperationStageNames(
    operations: readonly OperationForStageAvailability[],
    linkedOperations:
        | readonly OperationForStageAvailability[]
        | null
        | undefined,
): ReadonlySet<string> {
    const linkedOperationNames = new Set(
        (linkedOperations ?? []).map((operation) => operation.information.name),
    );
    const stageNames = new Set<string>();

    for (const operation of [...operations, ...(linkedOperations ?? [])]) {
        if (
            operation.attributes.internal === true ||
            !isOperationApplicableToPlant(operation, linkedOperationNames)
        ) {
            continue;
        }

        const stageName = operation.attributes.stage?.information?.name;
        if (stageName) {
            stageNames.add(stageName);
        }
    }

    return stageNames;
}
