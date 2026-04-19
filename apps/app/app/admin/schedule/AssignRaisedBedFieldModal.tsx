'use client';

import type { RaisedBedFieldAssignableFarmUser } from '@gredice/storage';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { User } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useMemo, useState } from 'react';
import { assignRaisedBedFieldUserAction } from '../../(actions)/raisedBedFieldsActions';

const missingAssignedUserLabel = 'Trenutno dodijeljeni korisnik';

type AssignableUser = Pick<
    RaisedBedFieldAssignableFarmUser,
    'id' | 'userName' | 'displayName' | 'avatarUrl'
>;

interface AssignRaisedBedFieldModalProps {
    raisedBedFieldId: number;
    label: string;
    farmUsers: AssignableUser[];
    assignedUserIds?: string[];
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
    assignedUserIds,
    disabled = false,
}: AssignRaisedBedFieldModalProps) {
    const [open, setOpen] = useState(false);
    const initialAssignedUserIds = useMemo(
        () => Array.from(new Set(assignedUserIds ?? [])),
        [assignedUserIds],
    );
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
        initialAssignedUserIds,
    );
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const selectableUsers = useMemo(() => {
        const usersById = new Map<string, AssignableUser>();
        for (const farmUser of farmUsers) {
            usersById.set(farmUser.id, farmUser);
        }

        for (const assignedUserId of initialAssignedUserIds) {
            if (!usersById.has(assignedUserId)) {
                usersById.set(assignedUserId, {
                    id: assignedUserId,
                    userName: missingAssignedUserLabel,
                    displayName: null,
                    avatarUrl: null,
                });
            }
        }

        return [...usersById.values()];
    }, [farmUsers, initialAssignedUserIds]);

    const canOpen =
        !disabled &&
        (selectableUsers.length > 0 || initialAssignedUserIds.length > 0);

    useEffect(() => {
        if (!open) {
            setSelectedUserIds(initialAssignedUserIds);
            setErrorMessage(null);
        }
    }, [initialAssignedUserIds, open]);

    const selectedUsers = useMemo(
        () =>
            initialAssignedUserIds
                .map((assignedUserId) =>
                    selectableUsers.find((user) => user.id === assignedUserId),
                )
                .filter((selectedUser): selectedUser is AssignableUser =>
                    Boolean(selectedUser),
                ),
        [initialAssignedUserIds, selectableUsers],
    );

    const toggleSelectedUser = (userId: string, checked: boolean) => {
        if (checked) {
            setSelectedUserIds((currentIds) =>
                currentIds.includes(userId)
                    ? currentIds
                    : [...currentIds, userId],
            );
            return;
        }

        setSelectedUserIds((currentIds) =>
            currentIds.filter((selectedUserId) => selectedUserId !== userId),
        );
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            await assignRaisedBedFieldUserAction(
                raisedBedFieldId,
                selectedUserIds,
            );
            setOpen(false);
        } catch (error) {
            console.error('Error assigning planting user:', error);
            setErrorMessage('Greška pri spremanju dodjele korisnika.');
        } finally {
            setIsLoading(false);
        }
    };

    const trigger =
        selectedUsers.length > 0 ? (
            <button
                type="button"
                className="rounded-full transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                title={`Dodijeljeno korisnika: ${selectedUsers.length}`}
                aria-label={`Dodijeljeno korisnika: ${selectedUsers.length}`}
                disabled={!canOpen}
            >
                <Row spacing={-1}>
                    {selectedUsers.slice(0, 2).map((selectedUser) => (
                        <UserAvatar
                            key={selectedUser.id}
                            avatarUrl={selectedUser.avatarUrl}
                            displayName={
                                selectedUser.displayName ??
                                selectedUser.userName
                            }
                            className="size-7 ring-2 ring-background"
                        />
                    ))}
                    {selectedUsers.length > 2 && (
                        <Typography level="body3">
                            +{selectedUsers.length - 2}
                        </Typography>
                    )}
                </Row>
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
                    Odaberi korisnike kojima želiš dodijeliti zadatak{' '}
                    <strong>{label}</strong>.
                </Typography>

                {selectableUsers.length > 0 ? (
                    <Stack spacing={1}>
                        <Button
                            variant="plain"
                            className="justify-start px-0"
                            onClick={() => setSelectedUserIds([])}
                            disabled={selectedUserIds.length === 0}
                        >
                            Ukloni sve dodjele
                        </Button>
                        {selectableUsers.map((user) => (
                            <Checkbox
                                key={user.id}
                                label={getUserLabel(user)}
                                checked={selectedUserIds.includes(user.id)}
                                onCheckedChange={(checked) =>
                                    toggleSelectedUser(
                                        user.id,
                                        Boolean(checked),
                                    )
                                }
                            />
                        ))}
                    </Stack>
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
                            (selectedUserIds.length ===
                                initialAssignedUserIds.length &&
                                selectedUserIds.every((selectedUserId) =>
                                    initialAssignedUserIds.includes(
                                        selectedUserId,
                                    ),
                                )) ||
                            (selectableUsers.length === 0 &&
                                initialAssignedUserIds.length === 0)
                        }
                    >
                        Spremi dodjelu
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}
