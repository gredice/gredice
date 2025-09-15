'use client';

import { User } from '@signalco/ui-icons';
import {
    type FilterOption,
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '../../../components/shared/filters';

// User role filter options
const USER_ROLE_FILTER_OPTIONS: FilterOption = {
    key: 'role',
    label: 'Uloga korisnika',
    icon: <User className="size-4" />,
    options: [
        { value: '', label: 'Sve uloge' },
        { value: 'admin', label: 'Administrator' },
        { value: 'user', label: 'Korisnik' },
    ],
};

export function UsersFilters() {
    const filters = [TIME_FILTER_OPTIONS, USER_ROLE_FILTER_OPTIONS];

    return (
        <TableFilter
            filters={filters}
            defaultValues={{
                from: 'last-30-days',
                role: '',
            }}
            className="flex"
        />
    );
}
