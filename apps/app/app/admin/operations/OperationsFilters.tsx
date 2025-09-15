'use client';

import {
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '../../../components/shared/filters';

export function OperationsFilters() {
    const filters = [TIME_FILTER_OPTIONS];

    return (
        <TableFilter
            filters={filters}
            defaultValues={{ from: 'last-14-days' }}
            className="flex"
        />
    );
}
