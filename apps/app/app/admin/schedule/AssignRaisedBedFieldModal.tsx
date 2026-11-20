'use client';

import type { RaisedBedFieldAssignableFarmUser } from '@gredice/storage';
import { IconButton } from '@gredice/ui/IconButton';
import { User } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useEffect, useMemo, useState } from 'react';
import { assignRaisedBedFieldUserAction } from '../../(actions)/raisedBedFieldsActions';
import { AssignUsersPanel } from './AssignUsersPanel';

const missingAssignedUserLabel = 'Trenutno dodijeljeni korisnik';

type AssignableUser = Pick<
    RaisedBedFieldAssignableFarmUser,
    'id' | 'userName' | 'displayName' | 'avatarUrl' | 'achievementCount'
>;

interface AssignRaisedBedFieldModalProps {
    raisedBedFieldId: number;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    label: string;
    farmUsers: AssignableUser[];
    assignedUserIds?: string[];
    disabled?: boolean;
    onSubmit?: (selectedUserIds: string[]) => unknown | Promise<unknown>;
}

export function AssignRaisedBedFieldModal({
    raisedBedFieldId,
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    expectedPlantSortId,
    label,
    farmUsers,
    assignedUserIds,
    disabled = false,
    onSubmit,
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

    const handleSubmit = async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            if (onSubmit) {
                await onSubmit(selectedUserIds);
            } else {
                await assignRaisedBedFieldUserAction(
                    raisedBedFieldId,
                    expectedPlantCycleEventId,
                    expectedPlantSortId,
                    expectedPlantCycleVersionEventId,
                    selectedUserIds,
                );
            }
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
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-full transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                title={`Dodijeljeno korisnika: ${selectedUsers.length}`}
                aria-label={`Dodijeljeno korisnika: ${selectedUsers.length}`}
                disabled={!canOpen}
            >
                <Row spacing={-2}>
                    {selectedUsers.slice(0, 2).map((selectedUser) => (
                        <UserAvatar
                            achievementCount={selectedUser.achievementCount}
                            key={selectedUser.id}
                            avatarUrl={selectedUser.avatarUrl}
                            displayName={
                                selectedUser.displayName ??
                                selectedUser.userName
                            }
                            className="size-6 ring-1 ring-background"
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
                variant="soft"
                color="warning"
                size="xs"
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
            <AssignUsersPanel
                title="Dodjela sijanja"
                description={
                    <>
                        Odaberi korisnike kojima želiš dodijeliti zadatak{' '}
                        <strong>{label}</strong>.
                    </>
                }
                users={selectableUsers}
                selectedUserIds={selectedUserIds}
                onSelectedUserIdsChange={setSelectedUserIds}
                errorMessage={errorMessage}
                isSaving={isLoading}
                saveDisabled={
                    (selectedUserIds.length === initialAssignedUserIds.length &&
                        selectedUserIds.every((selectedUserId) =>
                            initialAssignedUserIds.includes(selectedUserId),
                        )) ||
                    (selectableUsers.length === 0 &&
                        initialAssignedUserIds.length === 0)
                }
                onCancel={() => setOpen(false)}
                onSave={handleSubmit}
            />
        </Modal>
    );
}
