'use client';

import type {
    OperationAssignableFarmUser,
    RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { User } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    farmUsers: AssignableUser[];
};

type OperationAssignmentTarget = {
    id: number;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    farmUsers: AssignableUser[];
};

interface BulkAssignRaisedBedButtonProps {
    physicalId: string;
    targetLabel?: string;
    fields: FieldAssignmentTarget[];
    operations: OperationAssignmentTarget[];
    onSubmit?: (assignedUserIds: string[]) => unknown | Promise<unknown>;
}

function getUserLabel(user: AssignableUser) {
    return user.displayName
        ? `${user.displayName} (${user.userName})`
        : user.userName;
}

export function BulkAssignRaisedBedButton({
    physicalId,
    targetLabel,
    fields,
    operations,
    onSubmit,
}: BulkAssignRaisedBedButtonProps) {
    const [open, setOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(unassignedValue);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const totalItems = fields.length + operations.length;
    const disabled = totalItems === 0 || isSubmitting;
    const targetText =
        targetLabel ??
        (physicalId === 'dan' ? 'za dan' : `za gredicu ${physicalId}`);

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

        setErrorMessage(null);
        const assignedUserIds =
            selectedUserId === unassignedValue ? [] : [selectedUserId];

        if (onSubmit) {
            await onSubmit(assignedUserIds);
            setOpen(false);
            return;
        }

        setIsSubmitting(true);
        setOpen(false);
        void Promise.all([
            ...fields.map((field) =>
                assignRaisedBedFieldUserAction(
                    field.id,
                    field.expectedPlantCycleEventId,
                    field.expectedPlantSortId,
                    field.expectedPlantCycleVersionEventId,
                    assignedUserIds,
                ),
            ),
            ...operations.map((operation) =>
                assignOperationUserAction(
                    operation.id,
                    operation.expectedEntityId,
                    operation.expectedTaskVersionEventId,
                    assignedUserIds,
                ),
            ),
        ])
            .catch((error: unknown) => {
                console.error(
                    'Failed to assign users for all raised bed items:',
                    error,
                );
                alert('Skupna dodjela korisnika nije uspjela.');
            })
            .finally(() => setIsSubmitting(false));
    }

    return (
        <Modal
            title="Skupna dodjela korisnika"
            open={open}
            onOpenChange={handleOpenChange}
            trigger={
                <IconButton
                    variant="plain"
                    size="xs"
                    title="Dodijeli korisnika svim zadacima"
                    disabled={disabled}
                    aria-disabled={disabled}
                    loading={isSubmitting}
                >
                    <User className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <Stack spacing={4}>
                <Typography level="h5">Skupna dodjela korisnika</Typography>
                <Typography>
                    {`Odaberi korisnika za sve zadatke (${totalItems}) ${targetText}.`}
                </Typography>

                <UserPickerField
                    users={pickerUsers}
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    emptyOption={{
                        value: unassignedValue,
                        label: 'Bez dodjele',
                    }}
                />

                {errorMessage && (
                    <Typography level="body2" className="text-red-600">
                        {errorMessage}
                    </Typography>
                )}

                <Row spacing={2} justifyContent="end">
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
