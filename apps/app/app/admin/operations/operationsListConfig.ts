import type {
    OperationsListSort,
    OperationsListSortDirection,
    OperationsListSortKey,
} from './operationsListTypes';

export const defaultOperationsListSort: OperationsListSort = {
    key: 'date',
    direction: 'desc',
};

export function defaultOperationsListSortDirection(
    key: OperationsListSortKey,
): OperationsListSortDirection {
    return key === 'name' || key === 'place' || key === 'status'
        ? 'asc'
        : 'desc';
}
