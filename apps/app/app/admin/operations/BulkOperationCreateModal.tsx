'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { getEntities } from '../../../components/shared/attributes/actions/entitiesActions';
import { UserPickerField } from '../../../components/shared/fields/UserPickerField';
import { bulkCreateOperationsAction } from '../../(actions)/operationActions';
import { SelectEntity } from '../raised-beds/[raisedBedId]/SelectEntity';
import { TargetsSelectionList } from './TargetsSelectionList';

const unassignedValue = '__unassigned__';

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Kreiranje u tijeku...' : 'Kreiraj'}
        </Button>
    );
}

export type BulkOperationCreateModalProps = {
    gardens: Array<{
        id: number;
        name?: string | null;
        accountId?: string | null;
    }>;
    raisedBeds: Array<{
        id: number;
        name?: string | null;
        physicalId?: string | null;
        accountId?: string | null;
        gardenId?: number | null;
        fields: Array<{ id: number; positionIndex: number }>;
    }>;
    assignableUsers: Array<{
        id: string;
        userName: string;
        displayName: string | null;
    }>;
};

export function BulkOperationCreateModal({
    gardens,
    raisedBeds,
    assignableUsers,
}: BulkOperationCreateModalProps) {
    const [open, setOpen] = useState(false);
    const [selectedOperationId, setSelectedOperationId] = useState<
        string | null
    >(null);
    const [operations, setOperations] =
        useState<Awaited<ReturnType<typeof getEntities>>>();
    const [selectedAssignedUserId, setSelectedAssignedUserId] =
        useState(unassignedValue);
    const [selectedTargetsCount, setSelectedTargetsCount] = useState(0);
    const [state, formAction] = useActionState(
        bulkCreateOperationsAction,
        null,
    );
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        // Load operations metadata to determine application type
        getEntities('operation')
            .then((ops) => setOperations(ops))
            .catch((e) => console.error('Failed to load operations', e));
    }, []);

    const selectionMode = useMemo(() => {
        if (!selectedOperationId) return undefined;
        const application = operations?.find(
            (o) => o.id?.toString() === selectedOperationId,
        )?.attributes?.application as
            | 'garden'
            | 'raisedBedFull'
            | 'raisedBed1m'
            | 'plant'
            | undefined;
        if (!application) return undefined;
        if (application === 'garden') return 'garden' as const;
        if (application === 'plant') return 'plant' as const;
        // Treat both raised bed variants the same
        return 'raisedBed' as const;
    }, [operations, selectedOperationId]);

    useEffect(() => {
        if (!state?.success) return;

        setOpen(false);
        setSelectedOperationId(null);
        setSelectedAssignedUserId(unassignedValue);
        setSelectedTargetsCount(0);
        formRef.current?.reset();
    }, [state?.success]);

    const handleSubmit = (formData: FormData) => {
        setSelectedTargetsCount(formData.getAll('targets').length);
        return formAction(formData);
    };

    return (
        <Modal
            title={'Nova radnja'}
            trigger={<Button variant="outlined">Dodaj više</Button>}
            open={open}
            onOpenChange={setOpen}
        >
            <form ref={formRef} action={handleSubmit} className="space-y-4">
                <Stack spacing={2}>
                    <Typography level="h5">Nove radnje</Typography>
                    <SelectEntity
                        name="entityId"
                        label="Radnja"
                        required
                        entityTypeName={'operation'}
                        value={selectedOperationId}
                        onChange={setSelectedOperationId}
                    />
                    <Input
                        name="scheduledDate"
                        type="datetime-local"
                        label="Planirani datum (opcionalno)"
                    />
                    <UserPickerField
                        users={assignableUsers.map((user) => ({
                            id: user.id,
                            label: user.displayName
                                ? `${user.displayName} (${user.userName})`
                                : user.userName,
                            searchText: `${user.displayName ?? ''} ${
                                user.userName
                            }`,
                        }))}
                        value={selectedAssignedUserId}
                        onValueChange={setSelectedAssignedUserId}
                        label="Dodijeljeni korisnik (opcionalno)"
                        emptyOption={{
                            value: unassignedValue,
                            label: 'Bez dodjele',
                        }}
                    />
                    <input
                        type="hidden"
                        name="assignedUserId"
                        value={
                            selectedAssignedUserId === unassignedValue
                                ? ''
                                : selectedAssignedUserId
                        }
                    />
                    <TargetsSelectionList
                        name="targets"
                        gardens={gardens}
                        raisedBeds={raisedBeds}
                        mode={selectionMode}
                    />
                    <SubmitButton />
                    {state?.message && (
                        <Typography
                            level="body2"
                            className={
                                state.success
                                    ? 'text-green-600'
                                    : 'text-red-600'
                            }
                        >
                            {state.message}
                        </Typography>
                    )}
                    {!state?.success && selectedTargetsCount > 0 && (
                        <FormProgress
                            selectedTargetsCount={selectedTargetsCount}
                        />
                    )}
                </Stack>
            </form>
        </Modal>
    );
}

function FormProgress({
    selectedTargetsCount,
}: {
    selectedTargetsCount: number;
}) {
    const { pending } = useFormStatus();
    if (!pending) return null;

    return (
        <Typography level="body2" className="text-muted-foreground">
            Kreiranje {selectedTargetsCount} radnji je u tijeku...
        </Typography>
    );
}
