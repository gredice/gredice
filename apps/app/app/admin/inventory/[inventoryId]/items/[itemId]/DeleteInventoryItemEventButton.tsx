'use client';

import { Delete } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useTransition } from 'react';
import { deleteInventoryItemEventAction } from '../../../../../(actions)/inventoryActions';

export function DeleteInventoryItemEventButton({
    inventoryConfigId,
    itemId,
    eventId,
}: {
    inventoryConfigId: number;
    itemId: number;
    eventId: number;
}) {
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        if (!confirm('Da li ste sigurni da želite obrisati ovaj događaj?')) {
            return;
        }

        startTransition(async () => {
            await deleteInventoryItemEventAction(
                inventoryConfigId,
                itemId,
                eventId,
            );
        });
    };

    return (
        <IconButton
            title="Obriši događaj"
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
