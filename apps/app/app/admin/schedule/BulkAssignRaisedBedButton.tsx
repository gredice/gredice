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
import { AssignUsersPanel } from './AssignUsersPanel';

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

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setSelectedUserIds([]);
            setErrorMessage(null);
        }
    };

    async function handleSubmit() {
        if (totalItems === 0) {
            return;
        }

        setErrorMessage(null);
        const assignedUserIds = selectedUserIds.filter((userId) =>
            selectableUsers.some((user) => user.id === userId),
        );

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
                description={`Odaberi korisnike za sve zadatke (${totalItems}) ${targetText}. Bez odabira se uklanjaju sve dodjele.`}
                users={selectableUsers}
                selectedUserIds={selectedUserIds}
                onSelectedUserIdsChange={setSelectedUserIds}
                errorMessage={errorMessage}
                isSaving={isSubmitting}
                saveDisabled={totalItems === 0}
                emptyMessage="Nema korisnika dostupnih za sve odabrane zadatke."
                onCancel={() => handleOpenChange(false)}
                onSave={handleSubmit}
            />
        </Modal>
    );
}

export default BulkAssignRaisedBedButton;
