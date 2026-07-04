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

export type OperationsListOperation = {
    id: number;
    entityId: number;
    entityTypeName: string;
    label: string;
    operationDefinition: OperationsListOperationDefinition;
    status: OperationsListStatus;
    accountUserNames: string[];
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

export type OperationsListPage = {
    operations: OperationsListOperation[];
    hasMore: boolean;
    nextOffset: number | null;
    pageSize: number;
    totalCount: number;
};
