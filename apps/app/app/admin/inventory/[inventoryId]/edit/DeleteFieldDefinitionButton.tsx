'use client';

import { Delete } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useTransition } from 'react';

export function DeleteFieldDefinitionButton({
    inventoryConfigId,
    fieldId,
    onDelete,
}: {
    inventoryConfigId: number;
    fieldId: number;
    onDelete: (inventoryConfigId: number, fieldId: number) => Promise<void>;
}) {
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        if (!confirm('Da li ste sigurni da želite obrisati ovo polje?')) {
            return;
        }

        startTransition(async () => {
            await onDelete(inventoryConfigId, fieldId);
        });
    };

    return (
        <IconButton
            title="Obriši polje"
            variant="plain"
            color="danger"
            size="sm"
            onClick={handleDelete}
            loading={isPending}
        >
            <Delete className="size-4" />
        </IconButton>
    );
}
