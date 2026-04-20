'use client';

import { Bank, User } from '@signalco/ui-icons';
import {
    type FilterOption,
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '../../../components/shared/filters';

export function SunflowersFilters({
    users,
    accounts,
}: {
    users: Array<{ id: string; label: string }>;
    accounts: Array<{ id: string; label: string }>;
}) {
    const userOptions: FilterOption = {
        key: 'userId',
        label: 'Korisnik',
        icon: <User className="size-4" />,
        options: [
            { value: '', label: 'Svi korisnici' },
            ...users.map((user) => ({
                value: user.id,
                label: user.label,
            })),
        ],
    };

    const accountOptions: FilterOption = {
        key: 'accountId',
        label: 'Račun',
        icon: <Bank className="size-4" />,
        options: [
            { value: '', label: 'Svi računi' },
            ...accounts.map((account) => ({
                value: account.id,
                label: account.label,
            })),
        ],
    };

    return (
        <TableFilter
            filters={[TIME_FILTER_OPTIONS, userOptions, accountOptions]}
            defaultValues={{
                from: 'last-30-days',
                userId: '',
                accountId: '',
            }}
            className="flex"
        />
    );
}
