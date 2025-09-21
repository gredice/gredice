'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useMemo, useState } from 'react';
import { getEntities } from '../../../components/shared/attributes/actions/entitiesActions';
import { bulkCreateOperationsAction } from '../../(actions)/operationActions';
import { SelectEntity } from '../raised-beds/[raisedBedId]/SelectEntity';
import { TargetsSelectionList } from './TargetsSelectionList';

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
};

export function BulkOperationCreateModal({
    gardens,
    raisedBeds,
}: BulkOperationCreateModalProps) {
    const [selectedOperationId, setSelectedOperationId] = useState<
        string | null
    >(null);
    const [operations, setOperations] =
        useState<Awaited<ReturnType<typeof getEntities>>>();

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

    return (
        <Modal
            title={'Nova radnja'}
            trigger={<Button variant="outlined">Dodaj više</Button>}
        >
            <form action={bulkCreateOperationsAction} className="space-y-4">
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
                    <TargetsSelectionList
                        name="targets"
                        gardens={gardens}
                        raisedBeds={raisedBeds}
                        mode={selectionMode}
                    />
                    <Button type="submit">Kreiraj</Button>
                </Stack>
            </form>
        </Modal>
    );
}
