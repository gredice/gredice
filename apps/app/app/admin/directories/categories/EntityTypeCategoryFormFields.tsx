'use client';

import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useState } from 'react';
import { IconPicker } from '../../../../../components/admin/directories/IconPicker';

export function EntityTypeCategoryFormFields({
    defaults,
}: {
    defaults?: { name: string; label: string; icon: string | null };
}) {
    const [icon, setIcon] = useState(defaults?.icon ?? '');

    return (
        <Stack spacing={3}>
            <Input
                name="name"
                label="Naziv"
                defaultValue={defaults?.name}
                placeholder="npr. proizvodi, usluge, materijali"
                required
            />
            <Input
                name="label"
                label="Labela"
                defaultValue={defaults?.label}
                placeholder="npr. Proizvodi, Usluge, Materijali"
                required
            />
            <IconPicker name="icon" value={icon} onValueChange={setIcon} />
        </Stack>
    );
}
