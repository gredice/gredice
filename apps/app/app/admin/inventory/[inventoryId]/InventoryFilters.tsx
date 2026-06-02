'use client';

import { Check, Error as ErrorIcon, Warning } from '@gredice/ui/icons';
import {
    type FilterOption,
    TableFilter,
} from '../../../../components/shared/filters';

const INVENTORY_STATE_FILTER_OPTIONS: FilterOption = {
    key: 'state',
    label: 'Stanje zalihe',
    icon: <Check className="size-4" />,
    options: [
        { value: '', label: 'Sve stavke' },
        {
            value: 'ok',
            label: 'OK',
            icon: <Check className="size-4 text-green-600" />,
        },
        {
            value: 'warning',
            label: 'Upozorenje',
            icon: <Warning className="size-4 text-amber-500" />,
        },
        {
            value: 'critical',
            label: 'Kritično',
            icon: <ErrorIcon className="size-4 text-red-500" />,
        },
    ],
};

export function InventoryFilters() {
    return (
        <TableFilter
            filters={[INVENTORY_STATE_FILTER_OPTIONS]}
            defaultValues={{ state: '' }}
            className="flex"
        />
    );
}
