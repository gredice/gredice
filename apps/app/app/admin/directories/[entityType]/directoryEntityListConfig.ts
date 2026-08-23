import type {
    DirectoryEntityListSort,
    DirectoryEntityListSortDirection,
    DirectoryEntityListSortKey,
} from './directoryEntityListTypes';

export const defaultDirectoryEntityListSort: DirectoryEntityListSort = {
    key: 'updatedAt',
    direction: 'desc',
};

export function defaultDirectoryEntityListSortDirection(
    key: DirectoryEntityListSortKey,
): DirectoryEntityListSortDirection {
    return key === 'updatedAt' || key === 'inventory' ? 'desc' : 'asc';
}
