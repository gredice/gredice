'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { getEntities } from '../../../components/shared/attributes/actions/entitiesActions';
import { UserPickerField } from '../../../components/shared/fields/UserPickerField';
import {
    type SingleCreateOperationActionState,
    singleCreateOperationAction,
} from '../../(actions)/operationActions';
import { SelectEntity } from '../raised-beds/[raisedBedId]/SelectEntity';
import {
    type TargetSelectionMode,
    TargetsSelectionList,
} from './TargetsSelectionList';

const unassignedValue = '__unassigned__';

export type SingleOperationCreateModalProps = {
    farms: Array<{
        id: number;
        name: string;
    }>;
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

export function SingleOperationCreateModal({
    farms,
    gardens,
    raisedBeds,
    assignableUsers,
}: SingleOperationCreateModalProps) {
    const [open, setOpen] = useState(false);
    const [selectedOperationId, setSelectedOperationId] = useState<
        string | null
    >(null);
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
    const [operations, setOperations] =
        useState<Awaited<ReturnType<typeof getEntities>>>();
    const [selectedAssignedUserId, setSelectedAssignedUserId] =
        useState(unassignedValue);
    const [state, formAction] = useActionState<
        SingleCreateOperationActionState | null,
        FormData
    >(singleCreateOperationAction, null);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        getEntities('operation')
            .then((ops) => setOperations(ops))
            .catch((e) => console.error('Failed to load operations', e));
    }, []);

    const selectionMode = useMemo<TargetSelectionMode | undefined>(() => {
        if (!selectedOperationId) return undefined;
        const application = operations?.find(
            (o) => o.id?.toString() === selectedOperationId,
        )?.attributes?.application;
        if (!application) return undefined;
        if (application === 'farm') return 'farm';
        if (application === 'garden') return 'garden';
        if (application === 'plant') return 'plant';
        return 'raisedBed';
    }, [operations, selectedOperationId]);

    useEffect(() => {
        if (!state?.success) return;
        setOpen(false);
        setSelectedOperationId(null);
        setSelectedTarget(null);
        setSelectedAssignedUserId(unassignedValue);
        formRef.current?.reset();
    }, [state?.success]);

    return (
        <Modal
            title={'Nova radnja'}
            trigger={<Button variant="outlined">Dodaj jednu</Button>}
            open={open}
            onOpenChange={setOpen}
        >
            <form ref={formRef} action={formAction} className="space-y-4">
                <Stack spacing={4}>
                    <Typography level="h5">Nova radnja</Typography>
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
                            searchText: `${user.displayName ?? ''} ${user.userName}`,
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
                        name="target"
                        farms={farms}
                        gardens={gardens}
                        raisedBeds={raisedBeds}
                        mode={selectionMode}
                        selectionType="single"
                        selectedValue={selectedTarget}
                        onSelectedValueChange={setSelectedTarget}
                    />
                    <Button type="submit">Kreiraj</Button>
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
                </Stack>
            </form>
        </Modal>
    );
}
