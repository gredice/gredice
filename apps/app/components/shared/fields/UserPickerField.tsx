'use client';

import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
    /**
     * @deprecated Use `noUsersMessage`. Retained for backwards compatibility.
     * Used as a fallback when `noUsersMessage` is not provided.
     */
    noResultsMessage?: string;
    /**
     * Message shown when there are no selectable users.
     * Takes precedence over `noResultsMessage` when both are provided.
     */
    noUsersMessage?: string;
};

export function UserPickerField({
    users,
    value,
    onValueChange,
    label = 'Korisnik',
    placeholder = 'Odaberi korisnika',
    emptyOption,
    noResultsMessage,
    noUsersMessage,
}: UserPickerFieldProps) {
    const emptyUsersMessage =
        noUsersMessage ?? noResultsMessage ?? 'Nema dostupnih korisnika.';

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
        <Stack spacing={2}>
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
                    {emptyUsersMessage}
                </Typography>
            )}
        </Stack>
    );
}
