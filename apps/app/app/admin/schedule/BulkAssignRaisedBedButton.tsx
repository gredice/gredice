'use client';

import type {
    OperationAssignableFarmUser,
    RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { User } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useState } from 'react';
import {
    UserPickerField,
    type UserPickerOption,
} from '../../../components/shared/fields/UserPickerField';
import { assignOperationUserAction } from '../../(actions)/operationActions';
import { assignRaisedBedFieldUserAction } from '../../(actions)/raisedBedFieldsActions';

const unassignedValue = '__unassigned__';

type AssignableUser = Pick<
    RaisedBedFieldAssignableFarmUser | OperationAssignableFarmUser,
    'id' | 'userName' | 'displayName'
>;

type FieldAssignmentTarget = {
    id: number;
    farmUsers: AssignableUser[];
};

type OperationAssignmentTarget = {
    id: number;
    farmUsers: AssignableUser[];
};

interface BulkAssignRaisedBedButtonProps {
    physicalId: string;
    fields: FieldAssignmentTarget[];
    operations: OperationAssignmentTarget[];
}

function getUserLabel(user: AssignableUser) {
    return user.displayName
        ? `${user.displayName} (${user.userName})`
        : user.userName;
}

export function BulkAssignRaisedBedButton({
    physicalId,
    fields,
    operations,
}: BulkAssignRaisedBedButtonProps) {
    const [open, setOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(unassignedValue);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const totalItems = fields.length + operations.length;
    const disabled = totalItems === 0 || isSubmitting;

    const selectableUsers = useMemo(() => {
        const targetUsers = [...fields, ...operations].map(
            (target) => target.farmUsers,
        );
        if (targetUsers.length === 0) {
            return [];
        }

        let commonUserIds = new Set(targetUsers[0]?.map((user) => user.id));
        const usersById = new Map<string, AssignableUser>(
            (targetUsers[0] ?? []).map((user) => [user.id, user]),
        );

        for (const users of targetUsers.slice(1)) {
            const ids = new Set(users.map((user) => user.id));
            commonUserIds = new Set(
                [...commonUserIds].filter((userId) => ids.has(userId)),
            );
            for (const user of users) {
                if (!usersById.has(user.id)) {
                    usersById.set(user.id, user);
                }
            }
        }

        return [...commonUserIds]
            .map((userId) => usersById.get(userId))
            .filter((user) => user !== undefined);
    }, [fields, operations]);

    const pickerUsers = useMemo<UserPickerOption[]>(
        () =>
            selectableUsers.map((user) => ({
                id: user.id,
                label: getUserLabel(user),
                searchText: `${user.displayName ?? ''} ${user.userName}`,
            })),
        [selectableUsers],
    );

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setSelectedUserId(unassignedValue);
            setErrorMessage(null);
        }
    };

    async function handleSubmit() {
        if (totalItems === 0) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);
        const assignedUserId =
            selectedUserId === unassignedValue ? null : selectedUserId;

        try {
            await Promise.all([
                ...fields.map((field) =>
                    assignRaisedBedFieldUserAction(field.id, assignedUserId),
                ),
                ...operations.map((operation) =>
                    assignOperationUserAction(operation.id, assignedUserId),
                ),
            ]);
            setOpen(false);
        } catch (error) {
            console.error(
                'Failed to assign users for all raised bed items:',
                error,
            );
            setErrorMessage('Greška pri spremanju skupne dodjele korisnika.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Modal
            title="Skupna dodjela korisnika"
            open={open}
            onOpenChange={handleOpenChange}
            trigger={
                <IconButton
                    variant="plain"
                    title="Dodijeli korisnika svim nepotvrđenim zadacima gredice"
                    disabled={disabled}
                    aria-disabled={disabled}
                    loading={isSubmitting}
                >
                    <User className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <Stack spacing={2}>
                <Typography level="h5">Skupna dodjela korisnika</Typography>
                <Typography>
                    Odaberi korisnika za sve nepotvrđene zadatke ({totalItems})
                    za gredicu <strong>{physicalId}</strong>.
                </Typography>

                <UserPickerField
                    users={pickerUsers}
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    emptyOption={{
                        value: unassignedValue,
                        label: 'Bez dodjele',
                    }}
                    resetKey={open}
                />

                {errorMessage && (
                    <Typography level="body2" className="text-red-600">
                        {errorMessage}
                    </Typography>
                )}

                <Row spacing={1} justifyContent="end">
                    <Button
                        variant="outlined"
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Odustani
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        disabled={
                            isSubmitting ||
                            (selectedUserId !== unassignedValue &&
                                selectableUsers.length === 0)
                        }
                    >
                        Spremi dodjelu
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

export default BulkAssignRaisedBedButton;
