'use client';

import type {
    OperationAssignableFarmUser,
    RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { IconButton } from '@gredice/ui/IconButton';
import { User } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { useMemo, useState } from 'react';
import { assignOperationUserAction } from '../../(actions)/operationActions';
import { assignRaisedBedFieldUserAction } from '../../(actions)/raisedBedFieldsActions';
import {
    AssignUsersPanel,
    type AssignUsersPanelUser,
} from './AssignUsersPanel';

const unavailableUserReason =
    'Više nije dostupan za sve zadatke. Ukloni odabir.';

type AssignableUser = Pick<
    RaisedBedFieldAssignableFarmUser | OperationAssignableFarmUser,
    'id' | 'userName' | 'displayName' | 'avatarUrl' | 'achievementCount'
>;

type FieldAssignmentTarget = {
    id: number;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    farmUsers: AssignableUser[];
    /** Confirmed tasks must keep at least one assigned user. */
    assignmentRequired?: boolean;
};

type OperationAssignmentTarget = {
    id: number;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    farmUsers: AssignableUser[];
    /** Confirmed tasks must keep at least one assigned user. */
    assignmentRequired?: boolean;
};

interface BulkAssignRaisedBedButtonProps {
    physicalId: string;
    targetLabel?: string;
    fields: FieldAssignmentTarget[];
    operations: OperationAssignmentTarget[];
    onSubmit?: (assignedUserIds: string[]) => unknown | Promise<unknown>;
}

export function BulkAssignRaisedBedButton({
    physicalId,
    targetLabel,
    fields,
    operations,
    onSubmit,
}: BulkAssignRaisedBedButtonProps) {
    const [open, setOpen] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const totalItems = fields.length + operations.length;
    const disabled = totalItems === 0 || isSubmitting;
    const targetText =
        targetLabel ??
        (physicalId === 'dan' ? 'za dan' : `za gredicu ${physicalId}`);

    const { selectableUsers, knownUsersById } = useMemo(() => {
        const targetUsers = [...fields, ...operations].map(
            (target) => target.farmUsers,
        );
        if (targetUsers.length === 0) {
            return {
                selectableUsers: [],
                knownUsersById: new Map<string, AssignableUser>(),
            };
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

        return {
            selectableUsers: [...commonUserIds]
                .map((userId) => usersById.get(userId))
                .filter((user) => user !== undefined),
            knownUsersById: usersById,
        };
    }, [fields, operations]);

    // Eligibility can change while the dialog is open (tasks refresh or an
    // optimistic update lands). Keep such selections visible so the admin can
    // revise them instead of silently dropping them on save.
    const unavailableSelectedUsers = useMemo<AssignUsersPanelUser[]>(
        () =>
            selectedUserIds
                .filter(
                    (userId) =>
                        !selectableUsers.some((user) => user.id === userId),
                )
                .map((userId) => ({
                    ...(knownUsersById.get(userId) ?? {
                        id: userId,
                        userName: 'Nepoznati korisnik',
                        displayName: null,
                        avatarUrl: null,
                    }),
                    unavailableReason: unavailableUserReason,
                })),
        [knownUsersById, selectableUsers, selectedUserIds],
    );
    const panelUsers = useMemo<AssignUsersPanelUser[]>(
        () => [...selectableUsers, ...unavailableSelectedUsers],
        [selectableUsers, unavailableSelectedUsers],
    );
    const protectedItemCount = [...fields, ...operations].filter(
        (target) => target.assignmentRequired,
    ).length;
    const hasUnavailableSelection = unavailableSelectedUsers.length > 0;
    const isClearBlocked =
        selectedUserIds.length === 0 && protectedItemCount > 0;
    const saveBlocked =
        totalItems === 0 || hasUnavailableSelection || isClearBlocked;

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setSelectedUserIds([]);
            setErrorMessage(null);
        }
    };

    async function handleSubmit() {
        if (saveBlocked) {
            return;
        }

        setErrorMessage(null);
        const assignedUserIds = selectedUserIds;

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
            <AssignUsersPanel
                title="Skupna dodjela korisnika"
                description={
                    protectedItemCount > 0
                        ? `Odaberi korisnike za sve zadatke (${totalItems}) ${targetText}. Potvrđeni zadaci (${protectedItemCount}) moraju ostati dodijeljeni, pa odaberi barem jednog korisnika.`
                        : `Odaberi korisnike za sve zadatke (${totalItems}) ${targetText}. Bez odabira se uklanjaju sve dodjele.`
                }
                notice={
                    hasUnavailableSelection
                        ? 'Neki odabrani korisnici više nisu dostupni za sve zadatke. Ukloni ih iz odabira prije spremanja.'
                        : undefined
                }
                users={panelUsers}
                selectedUserIds={selectedUserIds}
                onSelectedUserIdsChange={setSelectedUserIds}
                errorMessage={errorMessage}
                isSaving={isSubmitting}
                saveDisabled={saveBlocked}
                emptyMessage="Nema korisnika dostupnih za sve odabrane zadatke."
                onCancel={() => handleOpenChange(false)}
                onSave={handleSubmit}
            />
        </Modal>
    );
}

export default BulkAssignRaisedBedButton;
