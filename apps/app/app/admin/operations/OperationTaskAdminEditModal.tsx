'use client';

import type { OperationAssignedUser } from '@gredice/storage';
import {
    type OperationTaskAdminValues,
    operationTaskStatuses,
} from '@gredice/storage/operationTaskAdministration';
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Edit } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Switch } from '@gredice/ui/Switch';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { updateOperationTaskAdminAction } from '../../(actions)/operationTaskAdminActions';
import {
    operationTaskDateFields,
    operationTaskDateInputValue,
    operationTaskWithStatus,
} from './operationTaskAdminModel';

const statusLabels = {
    new: 'Novo',
    planned: 'Planirano',
    pendingVerification: 'Čeka verifikaciju',
    completed: 'Završeno',
    blocked: 'Blokirano',
    failed: 'Neuspjelo',
    canceled: 'Otkazano',
};
const outcomeFields = [
    { name: 'blockReasonLabel', label: 'Razlog blokade' },
    { name: 'blockReasonCode', label: 'Kod razloga blokade' },
    { name: 'blockNote', label: 'Napomena prepreke' },
    { name: 'error', label: 'Greška' },
    { name: 'errorCode', label: 'Kod greške' },
    { name: 'cancelReason', label: 'Razlog otkazivanja' },
] as const;

export function OperationTaskAdminEditModal({
    operationId,
    taskVersionEventId,
    initialValues,
    operationOptions,
    assignableUsers,
}: {
    operationId: number;
    taskVersionEventId: number;
    initialValues: OperationTaskAdminValues;
    operationOptions: { id: number; label: string }[];
    assignableUsers: OperationAssignedUser[];
}) {
    const router = useRouter();
    const approvalId = useId();
    const [open, setOpen] = useState(false);
    const [values, setValues] = useState(initialValues);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conflict, setConflict] = useState(false);
    const openedVersion = useRef(taskVersionEventId);

    function onOpenChange(nextOpen: boolean) {
        if (saving) return;
        setOpen(nextOpen);
        if (nextOpen) {
            setValues(initialValues);
            setError(null);
            setConflict(false);
            openedVersion.current = taskVersionEventId;
        }
    }

    async function save() {
        setSaving(true);
        setError(null);
        try {
            const result = await updateOperationTaskAdminAction(
                operationId,
                openedVersion.current,
                values,
            );
            if (!result.success) {
                setError(result.message ?? 'Spremanje nije uspjelo.');
                if ('conflict' in result && result.conflict) {
                    setConflict(true);
                    router.refresh();
                }
                return;
            }
            setOpen(false);
            router.refresh();
        } catch {
            setError('Spremanje nije uspjelo. Pokušaj ponovno.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            title="Uredi zadatak radnje"
            className="max-w-3xl"
            open={open}
            onOpenChange={onOpenChange}
            trigger={
                <IconButton
                    variant="plain"
                    size="sm"
                    title="Uredi zadatak radnje"
                    aria-label="Uredi zadatak radnje"
                >
                    <Edit className="size-4" />
                </IconButton>
            }
        >
            {open && (
                <form
                    className="space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save();
                    }}
                >
                    <fieldset
                        disabled={saving || conflict}
                        className="min-w-0 space-y-5"
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <SelectItems
                                label="Radnja"
                                value={String(values.entityId)}
                                items={operationOptions.map((option) => ({
                                    value: String(option.id),
                                    label: option.label,
                                }))}
                                onValueChange={(value) =>
                                    setValues((current) => ({
                                        ...current,
                                        entityId: Number(value),
                                    }))
                                }
                            />
                            <SelectItems
                                label="Status"
                                value={values.status}
                                items={operationTaskStatuses.map((status) => ({
                                    value: status,
                                    label: statusLabels[status],
                                }))}
                                onValueChange={(status) =>
                                    setValues((current) =>
                                        operationTaskWithStatus(
                                            current,
                                            status,
                                        ),
                                    )
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                            <label
                                htmlFor={approvalId}
                                className="text-sm font-medium"
                            >
                                Potvrđena radnja
                            </label>
                            <Switch
                                id={approvalId}
                                checked={values.isAccepted}
                                onCheckedChange={(isAccepted) =>
                                    setValues((current) => ({
                                        ...current,
                                        isAccepted,
                                    }))
                                }
                            />
                        </div>
                        <fieldset className="min-w-0 space-y-2">
                            <legend className="mb-2 text-sm font-medium">
                                Dodijeljeni korisnici
                            </legend>
                            <div className="grid max-h-48 gap-3 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                                {assignableUsers.map((user) => (
                                    <Checkbox
                                        key={user.id}
                                        checked={values.assignedUserIds.includes(
                                            user.id,
                                        )}
                                        label={
                                            <span className="flex min-w-0 items-center gap-2">
                                                <UserAvatar
                                                    className="size-6"
                                                    displayName={
                                                        user.displayName ??
                                                        user.userName
                                                    }
                                                    avatarUrl={user.avatarUrl}
                                                    achievementCount={
                                                        user.achievementCount
                                                    }
                                                />
                                                <span className="break-words">
                                                    {user.displayName ??
                                                        user.userName}
                                                </span>
                                            </span>
                                        }
                                        onCheckedChange={(checked) =>
                                            setValues((current) => ({
                                                ...current,
                                                assignedUserIds:
                                                    checked === true
                                                        ? [
                                                              ...current.assignedUserIds,
                                                              user.id,
                                                          ]
                                                        : current.assignedUserIds.filter(
                                                              (id) =>
                                                                  id !==
                                                                  user.id,
                                                          ),
                                            }))
                                        }
                                    />
                                ))}
                                {assignableUsers.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Nema dostupnih korisnika na farmi.
                                    </p>
                                )}
                            </div>
                        </fieldset>
                        <fieldset className="min-w-0">
                            <legend className="mb-3 text-sm font-medium">
                                Datumi
                            </legend>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {operationTaskDateFields.map((field) => (
                                    <Input
                                        key={field.name}
                                        label={field.label}
                                        fullWidth
                                        type="datetime-local"
                                        step="1"
                                        required={
                                            field.name === 'timestamp' ||
                                            field.name === 'createdAt'
                                        }
                                        value={operationTaskDateInputValue(
                                            values[field.name],
                                        )}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setValues((current) => ({
                                                ...current,
                                                [field.name]: value
                                                    ? new Date(
                                                          value,
                                                      ).toISOString()
                                                    : null,
                                            }));
                                        }}
                                    />
                                ))}
                            </div>
                        </fieldset>
                        <Input
                            label="Napomena korisnika"
                            fullWidth
                            value={values.requestNote}
                            maxLength={2000}
                            onChange={(event) =>
                                setValues((current) => ({
                                    ...current,
                                    requestNote: event.target.value,
                                }))
                            }
                        />
                        <details
                            open={['blocked', 'failed', 'canceled'].includes(
                                values.status,
                            )}
                        >
                            <summary className="cursor-pointer text-sm font-medium">
                                Podaci ishoda
                            </summary>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {outcomeFields.map((field) => (
                                    <Input
                                        key={field.name}
                                        label={field.label}
                                        fullWidth
                                        value={values[field.name]}
                                        maxLength={
                                            field.name.endsWith('Code')
                                                ? 100
                                                : field.name ===
                                                    'blockReasonLabel'
                                                  ? 200
                                                  : 2000
                                        }
                                        onChange={(event) =>
                                            setValues((current) => ({
                                                ...current,
                                                [field.name]:
                                                    event.target.value,
                                            }))
                                        }
                                    />
                                ))}
                            </div>
                        </details>
                    </fieldset>
                    {error && (
                        <p role="alert" className="text-sm text-red-600">
                            {error}
                            {conflict &&
                                ' Zatvori i ponovno otvori uređivanje za najnovije podatke.'}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outlined"
                            type="button"
                            disabled={saving}
                            onClick={() => onOpenChange(false)}
                        >
                            Odustani
                        </Button>
                        <Button
                            variant="solid"
                            type="submit"
                            loading={saving}
                            disabled={saving || conflict}
                        >
                            Spremi izmjene
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
