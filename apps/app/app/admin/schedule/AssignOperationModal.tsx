'use client';

import type {
    OperationAssignableFarmUser,
    OperationAssignedUser,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { IconButton } from '@gredice/ui/IconButton';
import { User } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useEffect, useMemo, useState } from 'react';
import { assignOperationUserAction } from '../../(actions)/operationActions';

type AssignableUser = Pick<
    OperationAssignableFarmUser,
    'id' | 'userName' | 'displayName' | 'avatarUrl'
>;

interface AssignOperationModalProps {
    operationId: number;
    label: string;
    farmUsers: AssignableUser[];
    assignedUsers?: OperationAssignedUser[];
    disabled?: boolean;
    onSubmit?: (selectedUserIds: string[]) => unknown | Promise<unknown>;
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
    assignedUsers,
    disabled = false,
    onSubmit,
}: AssignOperationModalProps) {
    const [open, setOpen] = useState(false);
    const initialAssignedUserIds = useMemo(
        () => Array.from(new Set((assignedUsers ?? []).map((user) => user.id))),
        [assignedUsers],
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

        for (const assignedUser of assignedUsers ?? []) {
            if (!usersById.has(assignedUser.id)) {
                usersById.set(assignedUser.id, assignedUser);
            }
        }

        return [...usersById.values()];
    }, [farmUsers, assignedUsers]);

    const canOpen =
        !disabled &&
        (selectableUsers.length > 0 || initialAssignedUserIds.length > 0);

    useEffect(() => {
        if (!open) {
            setSelectedUserIds(initialAssignedUserIds);
            setErrorMessage(null);
        }
    }, [initialAssignedUserIds, open]);

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
            if (onSubmit) {
                await onSubmit(selectedUserIds);
            } else {
                await assignOperationUserAction(operationId, selectedUserIds);
            }
            setOpen(false);
        } catch (error) {
            console.error('Error assigning operation user:', error);
            setErrorMessage('Greška pri spremanju dodjele korisnika.');
        } finally {
            setIsLoading(false);
        }
    };

    const trigger =
        (assignedUsers?.length ?? 0) > 0 ? (
            <button
                type="button"
                className="rounded-full transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                title={`Dodijeljeno korisnika: ${assignedUsers?.length ?? 0}`}
                aria-label={`Dodijeljeno korisnika: ${assignedUsers?.length ?? 0}`}
                disabled={!canOpen}
            >
                <Row spacing={-2}>
                    {(assignedUsers ?? []).slice(0, 2).map((assignedUser) => (
                        <UserAvatar
                            key={assignedUser.id}
                            avatarUrl={assignedUser.avatarUrl}
                            displayName={
                                assignedUser.displayName ??
                                assignedUser.userName
                            }
                            className="size-7 ring-2 ring-background"
                        />
                    ))}
                    {(assignedUsers?.length ?? 0) > 2 && (
                        <Typography level="body3">
                            +{(assignedUsers?.length ?? 0) - 2}
                        </Typography>
                    )}
                </Row>
            </button>
        ) : (
            <IconButton
                variant="soft"
                color="warning"
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
            <Stack spacing={4}>
                <Typography level="h5">Dodjela radnje</Typography>
                <Typography>
                    Odaberi korisnike kojima želiš dodijeliti zadatak{' '}
                    <strong>{label}</strong>.
                </Typography>

                {selectableUsers.length > 0 ? (
                    <Stack spacing={2}>
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
                                onCheckedChange={(checked: boolean) =>
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

                <Row spacing={2} justifyContent="end">
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

export default AssignOperationModal;
