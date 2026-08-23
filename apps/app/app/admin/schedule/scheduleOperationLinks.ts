import { KnownPages } from '../../../src/KnownPages';

export function getScheduleOperationHref(operationId: number) {
    return KnownPages.Operation(operationId);
}
