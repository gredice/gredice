'use client';

import type {
    OperationAssignableFarmUser,
    OperationAssignedUser,
} from '@gredice/storage';
import { IconButton } from '@gredice/ui/IconButton';
import { User } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useEffect, useMemo, useState } from 'react';
import { assignOperationUserAction } from '../../(actions)/operationActions';
import { AssignUsersPanel } from './AssignUsersPanel';

type AssignableUser = Pick<
    OperationAssignableFarmUser,
    'id' | 'userName' | 'displayName' | 'avatarUrl' | 'achievementCount'
>;

interface AssignOperationModalProps {
    operationId: number;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    label: string;
    farmUsers: AssignableUser[];
    assignedUsers?: OperationAssignedUser[];
    disabled?: boolean;
    onSubmit?: (selectedUserIds: string[]) => unknown | Promise<unknown>;
}

export function AssignOperationModal({
    operationId,
    expectedEntityId,
    expectedTaskVersionEventId,
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

    const handleSubmit = async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            if (onSubmit) {
                await onSubmit(selectedUserIds);
            } else {
                await assignOperationUserAction(
                    operationId,
                    expectedEntityId,
                    expectedTaskVersionEventId,
                    selectedUserIds,
                );
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
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-full transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                title={`Dodijeljeno korisnika: ${assignedUsers?.length ?? 0}`}
                aria-label={`Dodijeljeno korisnika: ${assignedUsers?.length ?? 0}`}
                disabled={!canOpen}
            >
                <Row spacing={-2}>
                    {(assignedUsers ?? []).slice(0, 2).map((assignedUser) => (
                        <UserAvatar
                            achievementCount={assignedUser.achievementCount}
                            key={assignedUser.id}
                            avatarUrl={assignedUser.avatarUrl}
                            displayName={
                                assignedUser.displayName ??
                                assignedUser.userName
                            }
                            className="size-6 ring-1 ring-background"
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
                size="xs"
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
            <AssignUsersPanel
                title="Dodjela radnje"
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

export default AssignOperationModal;
