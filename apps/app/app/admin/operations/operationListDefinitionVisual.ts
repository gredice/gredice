import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import type { OperationsListOperationDefinition } from './operationsListTypes';

export function serializeOperationDefinitionForList(
    operationDefinition: EntityStandardized | undefined,
    fallbackLabel: string,
): OperationsListOperationDefinition {
    return {
        image:
            operationDefinition?.image ?? operationDefinition?.images ?? null,
        information: {
            label: operationDefinition?.information?.label ?? fallbackLabel,
        },
        attributes: {
            category: operationDefinition?.attributes?.category ?? null,
            stage: operationDefinition?.attributes?.stage ?? null,
        },
    };
}
