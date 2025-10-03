'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { assignFarmUserAction } from '../../../(actions)/farmActions';

type UserOption = {
    id: string;
    label: string;
};

type AssignFarmUserFormProps = {
    farmId: number;
    users: UserOption[];
    assignedUserIds: string[];
};

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();
    const isDisabled = pending || disabled;

    return (
        <Button type="submit" disabled={isDisabled}>
            {pending ? 'Dodavanje…' : 'Dodaj korisnika'}
        </Button>
    );
}

export function AssignFarmUserForm({
    farmId,
    users,
    assignedUserIds,
}: AssignFarmUserFormProps) {
    const assignedIdsSet = useMemo(
        () => new Set(assignedUserIds),
        [assignedUserIds],
    );
    const availableUsers = useMemo(
        () => users.filter((user) => !assignedIdsSet.has(user.id)),
        [assignedIdsSet, users],
    );
    const [selectedUser, setSelectedUser] = useState('');
    const [state, formAction] = useActionState(assignFarmUserAction, null);

    useEffect(() => {
        if (state?.success) {
            setSelectedUser('');
        }
    }, [state]);

    if (availableUsers.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Svi registrirani korisnici su već dodijeljeni ovoj farmi.
            </p>
        );
    }

    return (
        <form action={formAction} className="space-y-2">
            <Stack spacing={1}>
                <SelectItems
                    label="Korisnik"
                    placeholder="Odaberi korisnika"
                    value={selectedUser}
                    onValueChange={setSelectedUser}
                    items={availableUsers.map((user) => ({
                        value: user.id,
                        label: user.label,
                    }))}
                />
                <input type="hidden" name="farmId" value={farmId} />
                <input type="hidden" name="userId" value={selectedUser} />
                <SubmitButton disabled={!selectedUser} />
                {state && (
                    <p
                        className={`text-sm ${
                            state.success ? 'text-green-600' : 'text-red-600'
                        }`}
                    >
                        {state.message}
                    </p>
                )}
            </Stack>
        </form>
    );
}
