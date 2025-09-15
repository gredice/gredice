'use client';

import { Check } from '@signalco/ui-icons';
import {
    type FilterOption,
    TableFilter,
} from '../../../components/shared/filters';

// Raised bed status filter options
const BED_STATUS_FILTER_OPTIONS: FilterOption = {
    key: 'status',
    label: 'Status gredice',
    icon: <Check className="size-4" />,
    options: [
        { value: '', label: 'Svi statusi' },
        { value: 'new', label: 'Nova' },
        { value: 'active', label: 'Aktivna' },
    ],
};

export function RaisedBedsFilters() {
    const filters = [BED_STATUS_FILTER_OPTIONS];

    return (
        <TableFilter
            filters={filters}
            defaultValues={{
                status: 'active',
            }}
            className="flex"
        />
    );
}
