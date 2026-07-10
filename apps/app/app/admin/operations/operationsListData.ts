import 'server-only';

import {
    getAccounts,
    getAllOperations,
    getAllRaisedBeds,
    getEntitiesFormatted,
    getFarms,
    getGardens,
    getUsers,
} from '@gredice/storage';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { serializeOperationDefinitionForList } from './operationListDefinitionVisual';
import { defaultOperationsListSort } from './operationsListConfig';
import { filterOperationsByEntityIds } from './operationsListQuery';
import type {
    OperationEntityFilterOption,
    OperationsListOperation,
    OperationsListOperationDefinition,
    OperationsListOperationRow,
    OperationsListPage,
    OperationsListSort,
    OperationsListSortDirection,
    OperationsListSortKey,
    OperationsListSowingTask,
    OperationsListStatus,
} from './operationsListTypes';

type RawOperation = {
    id: number;
    entityId: number;
    entityTypeName: string;
    status: OperationsListStatus;
    accountId?: string | null;
    farmId?: number | null;
    gardenId?: number | null;
    raisedBedId?: number | null;
    raisedBedFieldId?: number | null;
    timestamp: Date | string;
    createdAt?: Date | string | null;
    scheduledDate?: Date | string | null;
    completedAt?: Date | string | null;
    assignedUsers?: Array<{
        userName: string | null;
        displayName: string | null;
    }>;
};
type RawOperations = RawOperation[];
type RawUser = {
    id: string;
    userName: string | null;
    displayName: string | null;
};
type RawRaisedBedFieldPlantCycle = {
    plantPlaceEventId: number;
    positionIndex: number;
    active: boolean;
    plantStatus?: string;
    plantSortId?: number;
    plantScheduledDate?: Date;
    sowingLocation: OperationsListSowingTask['sowingLocation'];
    plantSowDate?: Date;
    stoppedDate?: Date;
    startedAt: Date;
    endedAt: Date;
    assignedUserIds?: string[];
};
type RawRaisedBedField = {
    id: number;
    positionIndex: number;
    plantCycles: RawRaisedBedFieldPlantCycle[];
};
type RawRaisedBed = {
    id: number;
    accountId?: string | null;
    gardenId?: number | null;
    physicalId?: string | null;
    name?: string | null;
    fields: RawRaisedBedField[];
};

type RawAccount = {
    id: string;
    accountUsers: Array<{
        user: {
            userName: string | null;
        };
    }>;
};
type RawFarm = {
    id: number;
    name: string;
};
type RawGarden = {
    id: number;
    farmId: number;
    name: string;
};

export type OperationsListContext = {
    accounts: RawAccount[];
    farms: RawFarm[];
    gardens: RawGarden[];
    operationFilterOptions: OperationEntityFilterOption[];
    operationDefinitions: EntityStandardized[];
    plantSorts: EntityStandardized[];
    raisedBeds: RawRaisedBed[];
    users: RawUser[];
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

function operationDefinitionForOperation(
    operation: RawOperation,
    operationDefinitions: EntityStandardized[],
) {
    return operationDefinitions.find(
        (definition) => definition.id === operation.entityId,
    );
}

function entityLabel(entity: EntityStandardized | undefined, fallback: string) {
    return entity?.information?.label ?? entity?.information?.name ?? fallback;
}

function operationDefinitionLabel(
    operation: RawOperation,
    operationDefinition: EntityStandardized | undefined,
) {
    return entityLabel(operationDefinition, `Radnja ${operation.id}`);
}

function userDisplayName(user: RawUser | undefined) {
    return user?.displayName ?? user?.userName ?? null;
}

function isNonEmptyString(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.length > 0;
}

function assignedUserNamesFromIds(
    assignedUserIds: string[] | undefined,
    usersById: Map<string, RawUser>,
) {
    return (assignedUserIds ?? [])
        .map((userId) => userDisplayName(usersById.get(userId)) ?? userId)
        .filter(isNonEmptyString);
}

function operationAssignedUserNames(operation: RawOperation) {
    return (operation.assignedUsers ?? [])
        .map((user) => user.displayName ?? user.userName)
        .filter(isNonEmptyString);
}

function plantSortCoverUrl(plantSort: EntityStandardized | undefined) {
    return (
        plantSort?.image?.cover?.url ??
        plantSort?.images?.cover?.url ??
        plantSort?.information?.plant?.image?.cover?.url ??
        plantSort?.information?.plant?.images?.cover?.url ??
        null
    );
}

function sowingTaskOperationDefinition(
    label: string,
    plantSort: EntityStandardized | undefined,
): OperationsListOperationDefinition {
    const coverUrl = plantSortCoverUrl(plantSort);

    return {
        image: coverUrl ? { cover: { url: coverUrl } } : null,
        information: { label },
        attributes: {
            category: { information: { name: 'sowing' } },
            stage: null,
        },
    };
}

function operationDefinitionFilterLabel(definition: EntityStandardized) {
    return (
        definition.information?.label ??
        definition.information?.name ??
        `Radnja ${definition.id}`
    );
}

function operationFilterOptions(
    operationDefinitions: EntityStandardized[],
): OperationEntityFilterOption[] {
    return operationDefinitions
        .map((definition) => ({
            value: definition.id.toString(),
            label: operationDefinitionFilterLabel(definition),
        }))
        .toSorted((left, right) =>
            left.label.localeCompare(right.label, 'hr', {
                numeric: true,
                sensitivity: 'base',
            }),
        );
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
        return right.rowId.localeCompare(left.rowId, 'hr', {
            numeric: true,
            sensitivity: 'base',
        });
    }

    return sort.direction === 'asc' ? compared : -compared;
}

function serializeOperation(
    operation: RawOperation,
    context: OperationsListContext,
): OperationsListOperationRow {
    const operationDefinition = operationDefinitionForOperation(
        operation,
        context.operationDefinitions,
    );
    const label = operationDefinitionLabel(operation, operationDefinition);
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
        kind: 'operation',
        rowId: `operation:${operation.id}`,
        id: operation.id,
        entityId: operation.entityId,
        entityTypeName: operation.entityTypeName,
        label,
        operationDefinition: serializeOperationDefinitionForList(
            operationDefinition,
            label,
        ),
        status: operation.status,
        accountUserNames:
            account?.accountUsers
                .map((accountUser) => accountUser.user.userName)
                .filter(isNonEmptyString) ?? [],
        assignedUserNames: operationAssignedUserNames(operation),
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

function sowingTaskName(
    sowingLocation: RawRaisedBedFieldPlantCycle['sowingLocation'],
) {
    return sowingLocation === 'greenhouse' ? 'Sijanje u stakleniku' : 'Sijanje';
}

function sowingTaskEntityTypeName(
    sowingLocation: RawRaisedBedFieldPlantCycle['sowingLocation'],
): OperationsListSowingTask['entityTypeName'] {
    return sowingLocation === 'greenhouse' ? 'sowingGreenhouse' : 'sowing';
}

function sowingTaskStatus(
    cycle: RawRaisedBedFieldPlantCycle,
): OperationsListStatus {
    if (cycle.plantStatus === 'pendingVerification') {
        return 'pendingVerification';
    }

    if (cycle.plantSowDate) {
        return 'completed';
    }

    if (cycle.plantStatus === 'deleted' || !cycle.active) {
        return 'canceled';
    }

    if (cycle.plantStatus === 'planned') {
        return 'planned';
    }

    return 'new';
}

function sowingTaskRelevantDate(
    cycle: RawRaisedBedFieldPlantCycle,
    status: OperationsListStatus,
) {
    if (status === 'pendingVerification' || status === 'completed') {
        return cycle.plantSowDate ?? cycle.endedAt;
    }

    if (status === 'canceled') {
        return cycle.stoppedDate ?? cycle.endedAt;
    }

    return cycle.plantScheduledDate ?? cycle.startedAt;
}

function serializeSowingTask({
    context,
    cycle,
    field,
    raisedBed,
    usersById,
}: {
    context: OperationsListContext;
    cycle: RawRaisedBedFieldPlantCycle;
    field: RawRaisedBedField;
    raisedBed: RawRaisedBed;
    usersById: Map<string, RawUser>;
}): OperationsListSowingTask | null {
    if (typeof cycle.plantSortId !== 'number') {
        return null;
    }

    const status = sowingTaskStatus(cycle);
    const relevantDate = sowingTaskRelevantDate(cycle, status);
    const account = raisedBed.accountId
        ? context.accounts.find((item) => item.id === raisedBed.accountId)
        : undefined;
    const garden = raisedBed.gardenId
        ? context.gardens.find((item) => item.id === raisedBed.gardenId)
        : undefined;
    const farm = garden
        ? context.farms.find((item) => item.id === garden.farmId)
        : undefined;
    const plantSort = context.plantSorts.find(
        (candidate) => candidate.id === cycle.plantSortId,
    );
    const plantSortName = entityLabel(plantSort, `Sorta ${cycle.plantSortId}`);
    const label = `${sowingTaskName(cycle.sowingLocation)}: ${plantSortName}`;

    return {
        kind: 'sowing',
        rowId: `sowing:${field.id}:${cycle.plantPlaceEventId}`,
        id: field.id,
        entityId: null,
        entityTypeName: sowingTaskEntityTypeName(cycle.sowingLocation),
        plantSortId: cycle.plantSortId,
        plantCycleEventId: cycle.plantPlaceEventId,
        sowingLocation: cycle.sowingLocation,
        label,
        operationDefinition: sowingTaskOperationDefinition(label, plantSort),
        status,
        accountUserNames:
            account?.accountUsers
                .map((accountUser) => accountUser.user.userName)
                .filter(isNonEmptyString) ?? [],
        assignedUserNames: assignedUserNamesFromIds(
            cycle.assignedUserIds,
            usersById,
        ),
        farmName: farm?.name ?? null,
        gardenName: garden?.name ?? null,
        raisedBedPhysicalId: raisedBed.physicalId ?? null,
        raisedBedName: raisedBed.name ?? null,
        raisedBedFieldPosition: cycle.positionIndex + 1,
        timestamp: toIsoString(relevantDate) ?? new Date(0).toISOString(),
        createdAt: toIsoString(cycle.startedAt),
        scheduledDate: toIsoString(cycle.plantScheduledDate),
        completedAt:
            status === 'pendingVerification' || status === 'completed'
                ? toIsoString(cycle.plantSowDate ?? relevantDate)
                : null,
    };
}

function serializeSowingTasks(context: OperationsListContext) {
    const usersById = new Map(context.users.map((user) => [user.id, user]));

    return context.raisedBeds.flatMap((raisedBed) =>
        raisedBed.fields.flatMap((field) =>
            field.plantCycles
                .map((cycle) =>
                    serializeSowingTask({
                        context,
                        cycle,
                        field,
                        raisedBed,
                        usersById,
                    }),
                )
                .filter((operation): operation is OperationsListSowingTask =>
                    Boolean(operation),
                ),
        ),
    );
}

function operationIsOnOrAfterFromDate(
    operation: OperationsListOperation,
    fromDate: Date | undefined,
) {
    if (!fromDate) {
        return true;
    }

    return new Date(operation.timestamp) >= fromDate;
}

export async function getOperationsListContext(): Promise<OperationsListContext> {
    const [
        operationDefinitions,
        plantSorts,
        accounts,
        farms,
        gardens,
        raisedBeds,
        users,
    ] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('operation'),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getAccounts(),
        getFarms(),
        getGardens(),
        getAllRaisedBeds(),
        getUsers(),
    ]);

    return {
        accounts,
        farms,
        gardens,
        operationFilterOptions: operationFilterOptions(
            operationDefinitions ?? [],
        ),
        operationDefinitions: operationDefinitions ?? [],
        plantSorts: plantSorts ?? [],
        raisedBeds,
        users,
    };
}

export function buildOperationsListPage({
    context,
    fromDate,
    limit,
    offset = 0,
    operations,
    operationEntityIds = [],
    sort = defaultOperationsListSort,
}: {
    context: OperationsListContext;
    fromDate?: Date;
    limit?: number;
    offset?: number;
    operations: RawOperations;
    operationEntityIds?: number[];
    sort?: OperationsListSort;
}): OperationsListPage {
    const pageSize = normalizeLimit(limit);
    const filteredOperations = filterOperationsByEntityIds(
        operations,
        operationEntityIds,
    );
    const serializedOperations = [
        ...filteredOperations.map((operation) =>
            serializeOperation(operation, context),
        ),
        ...(operationEntityIds.length === 0
            ? serializeSowingTasks(context)
            : []),
    ]
        .filter((operation) =>
            operationIsOnOrAfterFromDate(operation, fromDate),
        )
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

export async function listOperationsPageFromContext({
    context,
    fromDate,
    limit,
    offset = 0,
    operationEntityIds = [],
    sort = defaultOperationsListSort,
}: {
    context: OperationsListContext;
    fromDate?: Date;
    limit?: number;
    offset?: number;
    operationEntityIds?: number[];
    sort?: OperationsListSort;
}): Promise<OperationsListPage> {
    const operations = await getAllOperations(
        fromDate ? { from: fromDate } : undefined,
    );

    return buildOperationsListPage({
        context,
        fromDate,
        limit,
        offset,
        operationEntityIds,
        operations,
        sort,
    });
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
