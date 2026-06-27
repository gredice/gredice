import 'server-only';

import {
    getAccounts,
    getAllOperations,
    getAllRaisedBeds,
    getEntitiesFormatted,
    getFarms,
    getGardens,
} from '@gredice/storage';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { defaultOperationsListSort } from './operationsListConfig';
import type {
    OperationsListOperation,
    OperationsListPage,
    OperationsListSort,
    OperationsListSortDirection,
    OperationsListSortKey,
} from './operationsListTypes';

type RawOperations = Awaited<ReturnType<typeof getAllOperations>>;
type RawOperation = RawOperations[number];

type OperationsListContext = {
    accounts: Awaited<ReturnType<typeof getAccounts>>;
    farms: Awaited<ReturnType<typeof getFarms>>;
    gardens: Awaited<ReturnType<typeof getGardens>>;
    operationDefinitions: EntityStandardized[];
    raisedBeds: Awaited<ReturnType<typeof getAllRaisedBeds>>;
};

export const operationsListPageSize = 40;
const maxOperationsListPageSize = 100;

export function normalizeOperationsListSortDirection(
    value: string | null,
): OperationsListSortDirection {
    return value === 'asc' ? 'asc' : 'desc';
}

export function normalizeOperationsListSortKey(
    value: string | null,
): OperationsListSortKey {
    if (
        value === 'date' ||
        value === 'createdAt' ||
        value === 'name' ||
        value === 'place' ||
        value === 'status'
    ) {
        return value;
    }

    return defaultOperationsListSort.key;
}

function normalizeLimit(limit: number | undefined) {
    if (!limit || !Number.isFinite(limit)) {
        return operationsListPageSize;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), maxOperationsListPageSize);
}

function toIsoString(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    return typeof value === 'string' ? value : value.toISOString();
}

function operationDefinitionLabel(
    operation: RawOperation,
    operationDefinitions: EntityStandardized[],
) {
    const operationDefinition = operationDefinitions.find(
        (definition) => definition.id === operation.entityId,
    );

    return operationDefinition?.information?.label ?? `Radnja ${operation.id}`;
}

function operationPlaceLabel(operation: OperationsListOperation) {
    return [
        operation.accountUserNames.join(', '),
        operation.farmName,
        operation.gardenName,
        operation.raisedBedPhysicalId
            ? `Gr ${operation.raisedBedPhysicalId}`
            : null,
        operation.raisedBedFieldPosition
            ? operation.raisedBedFieldPosition.toString()
            : null,
    ]
        .filter(Boolean)
        .join(' ');
}

function operationSortValue(
    operation: OperationsListOperation,
    key: OperationsListSortKey,
) {
    if (key === 'name') {
        return operation.label;
    }

    if (key === 'status') {
        return operation.status;
    }

    if (key === 'place') {
        return operationPlaceLabel(operation);
    }

    if (key === 'createdAt') {
        return operation.createdAt
            ? new Date(operation.createdAt).getTime()
            : 0;
    }

    return new Date(operation.timestamp).getTime();
}

function compareSortValues(left: string | number, right: string | number) {
    if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
    }

    return String(left).localeCompare(String(right), 'hr', {
        numeric: true,
        sensitivity: 'base',
    });
}

function compareOperations(
    left: OperationsListOperation,
    right: OperationsListOperation,
    sort: OperationsListSort,
) {
    const compared = compareSortValues(
        operationSortValue(left, sort.key),
        operationSortValue(right, sort.key),
    );

    if (compared === 0) {
        return right.id - left.id;
    }

    return sort.direction === 'asc' ? compared : -compared;
}

function serializeOperation(
    operation: RawOperation,
    context: OperationsListContext,
): OperationsListOperation {
    const account = operation.accountId
        ? context.accounts.find((item) => item.id === operation.accountId)
        : undefined;
    const farm = operation.farmId
        ? context.farms.find((item) => item.id === operation.farmId)
        : undefined;
    const garden = operation.gardenId
        ? context.gardens.find((item) => item.id === operation.gardenId)
        : undefined;
    const raisedBed = operation.raisedBedId
        ? context.raisedBeds.find((item) => item.id === operation.raisedBedId)
        : undefined;
    const raisedBedField =
        raisedBed && operation.raisedBedFieldId
            ? raisedBed.fields.find(
                  (field) => field.id === operation.raisedBedFieldId,
              )
            : undefined;

    return {
        id: operation.id,
        entityId: operation.entityId,
        entityTypeName: operation.entityTypeName,
        label: operationDefinitionLabel(
            operation,
            context.operationDefinitions,
        ),
        status: operation.status,
        accountUserNames:
            account?.accountUsers
                .map((accountUser) => accountUser.user.userName)
                .filter(Boolean) ?? [],
        farmName: farm?.name ?? null,
        gardenName: garden?.name ?? null,
        raisedBedPhysicalId: raisedBed?.physicalId ?? null,
        raisedBedName: raisedBed?.name ?? null,
        raisedBedFieldPosition:
            raisedBedField?.positionIndex === undefined
                ? null
                : raisedBedField.positionIndex + 1,
        timestamp:
            toIsoString(operation.timestamp) ?? new Date(0).toISOString(),
        createdAt: toIsoString(operation.createdAt),
        scheduledDate: toIsoString(operation.scheduledDate),
        completedAt: toIsoString(operation.completedAt),
    };
}

export async function getOperationsListContext(): Promise<OperationsListContext> {
    const [operationDefinitions, accounts, farms, gardens, raisedBeds] =
        await Promise.all([
            getEntitiesFormatted<EntityStandardized>('operation'),
            getAccounts(),
            getFarms(),
            getGardens(),
            getAllRaisedBeds(),
        ]);

    return {
        accounts,
        farms,
        gardens,
        operationDefinitions: operationDefinitions ?? [],
        raisedBeds,
    };
}

export async function listOperationsPageFromContext({
    context,
    fromDate,
    limit,
    offset = 0,
    sort = defaultOperationsListSort,
}: {
    context: OperationsListContext;
    fromDate?: Date;
    limit?: number;
    offset?: number;
    sort?: OperationsListSort;
}): Promise<OperationsListPage> {
    const pageSize = normalizeLimit(limit);
    const operations = await getAllOperations(
        fromDate ? { from: fromDate } : undefined,
    );
    const serializedOperations = operations
        .map((operation) => serializeOperation(operation, context))
        .toSorted((left, right) => compareOperations(left, right, sort));
    const safeOffset = Math.max(0, Math.trunc(offset));
    const pageOperations = serializedOperations.slice(
        safeOffset,
        safeOffset + pageSize + 1,
    );
    const hasMore = pageOperations.length > pageSize;

    return {
        operations: pageOperations.slice(0, pageSize),
        hasMore,
        nextOffset: hasMore ? safeOffset + pageSize : null,
        pageSize,
        totalCount: serializedOperations.length,
    };
}

export async function listOperationsPage({
    fromDate,
    ...options
}: Omit<Parameters<typeof listOperationsPageFromContext>[0], 'context'>) {
    const context = await getOperationsListContext();
    return listOperationsPageFromContext({
        ...options,
        context,
        fromDate,
    });
}
