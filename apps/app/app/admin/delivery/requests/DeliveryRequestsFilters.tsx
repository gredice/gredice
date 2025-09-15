'use client';

import { Check, Truck } from '@signalco/ui-icons';
import {
    type FilterOption,
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '../../../../components/shared/filters';

// Status filter options for delivery requests
const STATUS_FILTER_OPTIONS: FilterOption = {
    key: 'status',
    label: 'Status zahtjeva',
    icon: <Check className="size-4" />,
    options: [
        { value: '', label: 'Svi statusi' },
        { value: 'pending', label: 'Na čekanju' },
        { value: 'confirmed', label: 'Potvrđen' },
        { value: 'preparing', label: 'U pripremi' },
        { value: 'ready', label: 'Spreman' },
        { value: 'fulfilled', label: 'Ispunjen' },
        { value: 'cancelled', label: 'Otkazan' },
    ],
};

// Delivery mode filter options
const MODE_FILTER_OPTIONS: FilterOption = {
    key: 'mode',
    label: 'Način dostave',
    icon: <Truck className="size-4" />,
    options: [
        { value: '', label: 'Svi načini' },
        { value: 'delivery', label: 'Dostava' },
        { value: 'pickup', label: 'Preuzimanje' },
    ],
};

export function DeliveryRequestsFilters() {
    const filters = [
        TIME_FILTER_OPTIONS,
        STATUS_FILTER_OPTIONS,
        MODE_FILTER_OPTIONS,
    ];

    return (
        <TableFilter
            filters={filters}
            defaultValues={{
                from: 'last-30-days',
                status: '',
                mode: '',
            }}
            className="flex"
        />
    );
}
