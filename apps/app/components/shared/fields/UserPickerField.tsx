'use client';

import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

export type UserPickerOption = {
    id: string;
    label: string;
    searchText?: string;
};

type UserPickerFieldProps = {
    users: UserPickerOption[];
    value: string;
    onValueChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    searchPlaceholder?: string;
    searchAriaLabel?: string;
    emptyOption?: {
        value: string;
        label: string;
    };
    noResultsMessage?: string;
    resetKey?: unknown;
};

function normalizeSearchValue(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function UserPickerField({
    users,
    value,
    onValueChange,
    label = 'Korisnik',
    placeholder = 'Odaberi korisnika',
    searchPlaceholder = 'Pretraži korisnike',
    searchAriaLabel = 'Pretraži korisnike',
    emptyOption,
    noResultsMessage = 'Nema korisnika koji odgovara pretrazi.',
    resetKey,
}: UserPickerFieldProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);

    useEffect(() => {
        void resetKey;
        setSearchQuery('');
    }, [resetKey]);

    const normalizedSearchQuery = useMemo(
        () => normalizeSearchValue(deferredSearchQuery.trim()),
        [deferredSearchQuery],
    );

    const matchingUsers = useMemo(() => {
        if (!normalizedSearchQuery) {
            return users;
        }

        return users.filter((user) => {
            const searchableText = `${user.label} ${user.searchText ?? ''}`;
            return normalizeSearchValue(searchableText).includes(
                normalizedSearchQuery,
            );
        });
    }, [normalizedSearchQuery, users]);

    const selectedUser = useMemo(
        () => users.find((user) => user.id === value),
        [users, value],
    );

    const selectableUsers = useMemo(() => {
        const usersById = new Map<string, UserPickerOption>();

        if (selectedUser) {
            usersById.set(selectedUser.id, selectedUser);
        }

        for (const user of matchingUsers) {
            usersById.set(user.id, user);
        }

        return [...usersById.values()];
    }, [matchingUsers, selectedUser]);

    const items = useMemo(
        () => [
            ...(emptyOption ? [emptyOption] : []),
            ...selectableUsers.map((user) => ({
                value: user.id,
                label: user.label,
            })),
        ],
        [emptyOption, selectableUsers],
    );

    const hasNoMatches =
        normalizedSearchQuery.length > 0 && matchingUsers.length === 0;

    return (
        <Stack spacing={1}>
            <Input
                aria-label={searchAriaLabel}
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
            />

            {items.length > 0 ? (
                <SelectItems
                    label={label}
                    placeholder={placeholder}
                    value={value}
                    onValueChange={onValueChange}
                    items={items}
                />
            ) : (
                <Typography level="body2" className="text-muted-foreground">
                    {noResultsMessage}
                </Typography>
            )}

            {hasNoMatches && items.length > 0 && (
                <Typography level="body2" className="text-muted-foreground">
                    {noResultsMessage}
                </Typography>
            )}
        </Stack>
    );
}
