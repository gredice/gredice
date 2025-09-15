'use client';

import { Check } from '@signalco/ui-icons';
import {
    type FilterOption,
    TableFilter,
} from '../../../../components/shared/filters';

// Status filter options for delivery slots
const STATUS_FILTER_OPTIONS: FilterOption = {
    key: 'status',
    label: 'Status slotova',
    icon: <Check className="size-4" />,
    options: [
        { value: 'active', label: 'Aktivni' },
        { value: 'all', label: 'Svi slotovi' },
    ],
};

export function TimeSlotsFilters() {
    const filters = [STATUS_FILTER_OPTIONS];

    return (
        <TableFilter
            filters={filters}
            defaultValues={{ status: 'active' }}
            className="flex"
        />
    );
}
