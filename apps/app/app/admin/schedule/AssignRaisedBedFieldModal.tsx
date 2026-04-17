'use client';

import type { RaisedBedFieldAssignableFarmUser } from '@gredice/storage';
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
import { assignRaisedBedFieldUserAction } from '../../(actions)/raisedBedFieldsActions';

const unassignedValue = '__unassigned__';
const missingAssignedUserLabel = 'Trenutno dodijeljeni korisnik';

type AssignableUser = Pick<
    RaisedBedFieldAssignableFarmUser,
    'id' | 'userName' | 'displayName' | 'avatarUrl'
>;

interface AssignRaisedBedFieldModalProps {
    raisedBedFieldId: number;
    label: string;
    farmUsers: AssignableUser[];
    assignedUserId?: string | null;
    disabled?: boolean;
}

function getUserLabel(user: AssignableUser) {
    return user.displayName
        ? `${user.displayName} (${user.userName})`
        : user.userName;
}

export function AssignRaisedBedFieldModal({
    raisedBedFieldId,
    label,
    farmUsers,
    assignedUserId,
    disabled = false,
}: AssignRaisedBedFieldModalProps) {
    const [open, setOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(
        assignedUserId ?? unassignedValue,
    );
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const selectableUsers = useMemo(() => {
        const usersById = new Map<string, AssignableUser>();
        for (const farmUser of farmUsers) {
            usersById.set(farmUser.id, farmUser);
        }

        if (assignedUserId && !usersById.has(assignedUserId)) {
            usersById.set(assignedUserId, {
                id: assignedUserId,
                userName: missingAssignedUserLabel,
                displayName: null,
                avatarUrl: null,
            });
        }

        return [...usersById.values()];
    }, [assignedUserId, farmUsers]);

    const pickerUsers = useMemo<UserPickerOption[]>(
        () =>
            selectableUsers.map((user) => ({
                id: user.id,
                label: getUserLabel(user),
                searchText: `${user.displayName ?? ''} ${user.userName}`,
            })),
        [selectableUsers],
    );

    const initialSelection = assignedUserId ?? unassignedValue;
    const canOpen =
        !disabled && (selectableUsers.length > 0 || !!assignedUserId);

    useEffect(() => {
        if (!open) {
            setSelectedUserId(initialSelection);
            setErrorMessage(null);
        }
    }, [initialSelection, open]);

    const selectedUser = useMemo(
        () =>
            assignedUserId
                ? selectableUsers.find((user) => user.id === assignedUserId)
                : undefined,
        [assignedUserId, selectableUsers],
    );

    const handleSubmit = async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            await assignRaisedBedFieldUserAction(
                raisedBedFieldId,
                selectedUserId === unassignedValue ? null : selectedUserId,
            );
            setOpen(false);
        } catch (error) {
            console.error('Error assigning planting user:', error);
            setErrorMessage('Greška pri spremanju dodjele korisnika.');
        } finally {
            setIsLoading(false);
        }
    };

    const trigger = selectedUser ? (
        <button
            type="button"
            className="rounded-full transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            title={`Dodjela: ${getUserLabel(selectedUser)}`}
            aria-label={`Dodjela: ${getUserLabel(selectedUser)}`}
            disabled={!canOpen}
        >
            <UserAvatar
                avatarUrl={selectedUser.avatarUrl}
                displayName={selectedUser.displayName ?? selectedUser.userName}
                className="size-7"
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
            aria-label={
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
                <Typography level="h5">Dodjela sijanja</Typography>
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
                        resetKey={open}
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
                            (selectableUsers.length === 0 && !assignedUserId)
                        }
                    >
                        Spremi dodjelu
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}
