'use client';

import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo } from 'react';

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
    emptyOption?: {
        value: string;
        label: string;
    };
    noResultsMessage?: string;
    resetKey?: unknown;
};

export function UserPickerField({
    users,
    value,
    onValueChange,
    label = 'Korisnik',
    placeholder = 'Odaberi korisnika',
    emptyOption,
    noResultsMessage = 'Nema korisnika koji odgovara pretrazi.',
}: UserPickerFieldProps) {
    const items = useMemo(
        () => [
            ...(emptyOption ? [emptyOption] : []),
            ...users.map((user) => ({
                value: user.id,
                label: user.label,
            })),
        ],
        [emptyOption, users],
    );

    return (
        <Stack spacing={1}>
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
        </Stack>
    );
}
