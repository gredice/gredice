import type {
    OperationsListRecordType,
    OperationsListSort,
} from './operationsListTypes';

export const operationsListOperationEntityParam = 'operations';
export const operationsListRecordTypeParam = 'type';

export function normalizeOperationsListRecordType(
    value: string | null | undefined,
): OperationsListRecordType {
    return value === 'operation' || value === 'sowing' ? value : 'all';
}

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
    recordType,
    sortKey,
}: {
    direction: OperationsListSort['direction'];
    fromFilter: string;
    limit: number;
    offset: number;
    operationEntityIds: number[];
    recordType: OperationsListRecordType;
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

    if (recordType !== 'all') {
        searchParams.set(operationsListRecordTypeParam, recordType);
    }

    return searchParams;
}

export function createOperationsListQueryKey({
    fromFilter,
    operationEntityIds,
    recordType,
    sort,
}: {
    fromFilter: string;
    operationEntityIds: number[];
    recordType: OperationsListRecordType;
    sort: OperationsListSort;
}) {
    return [
        'admin-operations',
        fromFilter,
        recordType,
        serializeOperationsListOperationEntityIds(operationEntityIds),
        sort.key,
        sort.direction,
    ];
}
