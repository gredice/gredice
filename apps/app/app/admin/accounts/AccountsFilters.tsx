'use client';

import { User } from '@signalco/ui-icons';
import {
    type FilterOption,
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '../../../components/shared/filters';

// Account type filter options (this can be expanded based on your account types)
const ACCOUNT_TYPE_FILTER_OPTIONS: FilterOption = {
    key: 'type',
    label: 'Tip računa',
    icon: <User className="size-4" />,
    options: [
        { value: '', label: 'Svi tipovi' },
        { value: 'personal', label: 'Osobni' },
        { value: 'business', label: 'Poslovni' },
        { value: 'premium', label: 'Premium' },
    ],
};

export function AccountsFilters() {
    const filters = [TIME_FILTER_OPTIONS, ACCOUNT_TYPE_FILTER_OPTIONS];

    return (
        <TableFilter
            filters={filters}
            defaultValues={{
                from: 'last-30-days',
                type: '',
            }}
            className="flex"
        />
    );
}
