import type { RaisedBedFieldSowingLocation } from '@gredice/storage';
import type { OperationImageProps } from '@gredice/ui/OperationImage';

export type OperationsListSortDirection = 'asc' | 'desc';

export type OperationsListSortKey =
    | 'date'
    | 'createdAt'
    | 'name'
    | 'place'
    | 'status';

export type OperationsListSort = {
    key: OperationsListSortKey;
    direction: OperationsListSortDirection;
};

export type OperationsListStatus =
    | 'new'
    | 'planned'
    | 'pendingVerification'
    | 'completed'
    | 'failed'
    | 'canceled';

export type OperationsListOperationDefinition =
    OperationImageProps['operation'];

type OperationsListRowBase = {
    rowId: string;
    id: number;
    label: string;
    operationDefinition: OperationsListOperationDefinition;
    status: OperationsListStatus;
    accountUserNames: string[];
    assignedUserNames: string[];
    farmName: string | null;
    gardenName: string | null;
    raisedBedPhysicalId: string | null;
    raisedBedName: string | null;
    raisedBedFieldPosition: number | null;
    timestamp: string;
    createdAt: string | null;
    scheduledDate: string | null;
    completedAt: string | null;
};

export type OperationsListOperationRow = OperationsListRowBase & {
    kind: 'operation';
    entityId: number;
    entityTypeName: string;
};

export type OperationsListSowingTask = OperationsListRowBase & {
    kind: 'sowing';
    entityId: null;
    entityTypeName: 'sowing' | 'sowingGreenhouse';
    plantSortId: number;
    plantCycleEventId: number;
    sowingLocation: RaisedBedFieldSowingLocation;
};

export type OperationsListOperation =
    | OperationsListOperationRow
    | OperationsListSowingTask;

export type OperationEntityFilterOption = {
    value: string;
    label: string;
};

export type OperationsListPage = {
    operations: OperationsListOperation[];
    hasMore: boolean;
    nextOffset: number | null;
    pageSize: number;
    totalCount: number;
};
