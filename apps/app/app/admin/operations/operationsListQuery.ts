import type { OperationsListSort } from './operationsListTypes';

export const operationsListOperationEntityParam = 'operations';

export function parseOperationsListOperationEntityIds(
    value: string | undefined,
) {
    if (!value) {
        return [];
    }

    const ids: number[] = [];
    const seenIds = new Set<number>();

    for (const part of value.split(',')) {
        const trimmedPart = part.trim();
        if (!/^\d+$/.test(trimmedPart)) {
            continue;
        }

        const id = Number.parseInt(trimmedPart, 10);
        if (id <= 0 || seenIds.has(id)) {
            continue;
        }

        ids.push(id);
        seenIds.add(id);
    }

    return ids;
}

export function serializeOperationsListOperationEntityIds(ids: number[]) {
    return parseOperationsListOperationEntityIds(ids.join(',')).join(',');
}

export function filterOperationsByEntityIds<T extends { entityId: number }>(
    operations: T[],
    operationEntityIds: number[],
) {
    if (!operationEntityIds.length) {
        return operations;
    }

    const selectedEntityIds = new Set(operationEntityIds);
    return operations.filter((operation) =>
        selectedEntityIds.has(operation.entityId),
    );
}

export function createOperationsListSearchParams({
    direction,
    fromFilter,
    limit,
    offset,
    operationEntityIds,
    sortKey,
}: {
    direction: OperationsListSort['direction'];
    fromFilter: string;
    limit: number;
    offset: number;
    operationEntityIds: number[];
    sortKey: OperationsListSort['key'];
}) {
    const searchParams = new URLSearchParams({
        direction,
        from: fromFilter,
        limit: String(limit),
        offset: String(offset),
        sort: sortKey,
    });
    const operationEntityValue =
        serializeOperationsListOperationEntityIds(operationEntityIds);

    if (operationEntityValue) {
        searchParams.set(
            operationsListOperationEntityParam,
            operationEntityValue,
        );
    }

    return searchParams;
}

export function createOperationsListQueryKey({
    fromFilter,
    operationEntityIds,
    sort,
}: {
    fromFilter: string;
    operationEntityIds: number[];
    sort: OperationsListSort;
}) {
    return [
        'admin-operations',
        fromFilter,
        serializeOperationsListOperationEntityIds(operationEntityIds),
        sort.key,
        sort.direction,
    ];
}
