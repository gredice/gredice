'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    UserPickerField,
    type UserPickerOption,
} from '../../../../components/shared/fields/UserPickerField';
import { assignFarmUserAction } from '../../../(actions)/farmActions';

type AssignFarmUserFormProps = {
    farmId: number;
    users: UserPickerOption[];
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
                <UserPickerField
                    users={availableUsers}
                    value={selectedUser}
                    onValueChange={setSelectedUser}
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
