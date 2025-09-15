'use client';

import {
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '../../../components/shared/filters';

export function AccountsFilters() {
    const filters = [TIME_FILTER_OPTIONS];

    return (
        <TableFilter
            filters={filters}
            defaultValues={{
                from: 'last-30-days',
            }}
            className="flex"
        />
    );
}
