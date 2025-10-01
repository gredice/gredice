'use client';

import {
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '../../../components/shared/filters';

export function FarmsFilters() {
    return (
        <TableFilter
            filters={[TIME_FILTER_OPTIONS]}
            defaultValues={{ from: 'last-30-days' }}
            className="flex"
        />
    );
}
