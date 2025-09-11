'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { bulkCreateOperationsAction } from '../../(actions)/operationActions';
import { SelectEntity } from '../raised-beds/[raisedBedId]/SelectEntity';

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
    return (
        <Modal
            title={'Nova operacija'}
            trigger={<Button variant="outlined">Dodaj više</Button>}
        >
            <form action={bulkCreateOperationsAction} className="space-y-4">
                <Stack spacing={2}>
                    <Typography level="h5">Nova operacija</Typography>
                    <Input
                        name="entityTypeName"
                        defaultValue="operation"
                        label="Tip entiteta"
                        hidden
                        required
                    />
                    <SelectEntity
                        name="entityId"
                        label="Operacija"
                        required
                        entityTypeName={'operation'}
                    />
                    <Input
                        name="scheduledDate"
                        type="datetime-local"
                        label="Planirani datum (opcionalno)"
                    />
                    <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-2">
                        {gardens
                            .filter((garden) => {
                                // Only show gardens that have raised beds with physicalId
                                const gardenRaisedBedsWithPhysicalId =
                                    raisedBeds.filter(
                                        (rb) =>
                                            rb.gardenId === garden.id &&
                                            rb.physicalId,
                                    );
                                return (
                                    gardenRaisedBedsWithPhysicalId.length > 0
                                );
                            })
                            .map((garden) => {
                                const gardenRaisedBeds = raisedBeds.filter(
                                    (rb) =>
                                        rb.gardenId === garden.id &&
                                        rb.physicalId,
                                );
                                return (
                                    <div key={garden.id} className="space-y-1">
                                        <label className="font-semibold flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                name="targets"
                                                value={`${garden.accountId ?? ''}|${garden.id}`}
                                            />
                                            {garden.name || `Vrt ${garden.id}`}
                                        </label>
                                        <div className="ml-4 space-y-1">
                                            {gardenRaisedBeds.map((rb) => (
                                                <div
                                                    key={rb.id}
                                                    className="space-y-1"
                                                >
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            name="targets"
                                                            value={`${rb.accountId ?? ''}|${rb.gardenId ?? ''}|${rb.id}`}
                                                        />
                                                        {rb.physicalId
                                                            ? `Gr ${rb.physicalId}`
                                                            : rb.name}
                                                    </label>
                                                    <div className="ml-4 space-y-1">
                                                        {rb.fields.map(
                                                            (field) => (
                                                                <label
                                                                    key={
                                                                        field.id
                                                                    }
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        name="targets"
                                                                        value={`${rb.accountId ?? ''}|${rb.gardenId ?? ''}|${rb.id}|${field.id}`}
                                                                    />
                                                                    {`Polje ${field.positionIndex + 1}`}
                                                                </label>
                                                            ),
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                    <Button type="submit">Kreiraj</Button>
                </Stack>
            </form>
        </Modal>
    );
}
