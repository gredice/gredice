'use client';

import type {
    OperationAssignableFarmUser,
    OperationAssignedUser,
} from '@gredice/storage';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { User } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useMemo, useState } from 'react';
import {
    UserPickerField,
    type UserPickerOption,
} from '../../../components/shared/fields/UserPickerField';
import { assignOperationUserAction } from '../../(actions)/operationActions';

const unassignedValue = '__unassigned__';

type AssignableUser = Pick<
    OperationAssignableFarmUser,
    'id' | 'userName' | 'displayName' | 'avatarUrl'
>;

interface AssignOperationModalProps {
    operationId: number;
    label: string;
    farmUsers: AssignableUser[];
    assignedUser?: OperationAssignedUser | null;
    disabled?: boolean;
}

function getUserLabel(user: AssignableUser | OperationAssignedUser) {
    return user.displayName
        ? `${user.displayName} (${user.userName})`
        : user.userName;
}

export function AssignOperationModal({
    operationId,
    label,
    farmUsers,
    assignedUser,
    disabled = false,
}: AssignOperationModalProps) {
    const [open, setOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(
        assignedUser?.id ?? unassignedValue,
    );
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const selectableUsers = useMemo(() => {
        const usersById = new Map<string, AssignableUser>();

        for (const farmUser of farmUsers) {
            usersById.set(farmUser.id, farmUser);
        }

        if (assignedUser && !usersById.has(assignedUser.id)) {
            usersById.set(assignedUser.id, assignedUser);
        }

        return [...usersById.values()];
    }, [farmUsers, assignedUser]);

    const pickerUsers = useMemo<UserPickerOption[]>(
        () =>
            selectableUsers.map((user) => ({
                id: user.id,
                label: getUserLabel(user),
                searchText: `${user.displayName ?? ''} ${user.userName}`,
            })),
        [selectableUsers],
    );

    const initialSelection = assignedUser?.id ?? unassignedValue;
    const canOpen = !disabled && (selectableUsers.length > 0 || !!assignedUser);

    useEffect(() => {
        if (!open) {
            setSelectedUserId(initialSelection);
            setErrorMessage(null);
        }
    }, [initialSelection, open]);

    const handleSubmit = async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            await assignOperationUserAction(
                operationId,
                selectedUserId === unassignedValue ? null : selectedUserId,
            );
            setOpen(false);
        } catch (error) {
            console.error('Error assigning operation user:', error);
            setErrorMessage('Greška pri spremanju dodjele korisnika.');
        } finally {
            setIsLoading(false);
        }
    };

    const trigger = assignedUser ? (
        <button
            type="button"
            className="rounded-full transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            title={`Dodjela: ${getUserLabel(assignedUser)}`}
            disabled={!canOpen}
        >
            <UserAvatar
                avatarUrl={assignedUser.avatarUrl}
                displayName={assignedUser.displayName ?? assignedUser.userName}
                className="size-7 rounded-full"
            />
        </button>
    ) : (
        <IconButton
            variant="plain"
            title={
                canOpen
                    ? 'Dodijeli korisnika'
                    : 'Nema dostupnih korisnika za dodjelu'
            }
            disabled={!canOpen}
        >
            <User className="size-4 shrink-0" />
        </IconButton>
    );

    return (
        <Modal
            trigger={trigger}
            title={`Dodjela: ${label}`}
            open={open}
            onOpenChange={setOpen}
        >
            <Stack spacing={2}>
                <Typography level="h5">Dodjela radnje</Typography>
                <Typography>
                    Odaberi korisnika kojem želiš dodijeliti zadatak{' '}
                    <strong>{label}</strong>.
                </Typography>

                {selectableUsers.length > 0 ? (
                    <UserPickerField
                        users={pickerUsers}
                        value={selectedUserId}
                        onValueChange={setSelectedUserId}
                        emptyOption={{
                            value: unassignedValue,
                            label: 'Bez dodjele',
                        }}
                    />
                ) : (
                    <Typography level="body2" className="text-muted-foreground">
                        Na ovu farmu još nije dodijeljen nijedan korisnik.
                    </Typography>
                )}

                {errorMessage && (
                    <Typography level="body2" className="text-red-600">
                        {errorMessage}
                    </Typography>
                )}

                <Row spacing={1} justifyContent="end">
                    <Button
                        variant="outlined"
                        onClick={() => setOpen(false)}
                        disabled={isLoading}
                    >
                        Odustani
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleSubmit}
                        loading={isLoading}
                        disabled={
                            isLoading ||
                            selectedUserId === initialSelection ||
                            (selectableUsers.length === 0 && !assignedUser)
                        }
                    >
                        Spremi dodjelu
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

export default AssignOperationModal;
