'use client';

import { Delete } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useTransition } from 'react';
import { deleteInventoryItemAction } from '../../../(actions)/inventoryActions';

export function DeleteInventoryItemButton({
    inventoryConfigId,
    itemId,
}: {
    inventoryConfigId: number;
    itemId: number;
}) {
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        if (!confirm('Da li ste sigurni da želite obrisati ovu stavku?')) {
            return;
        }

        startTransition(async () => {
            await deleteInventoryItemAction(inventoryConfigId, itemId);
        });
    };

    return (
        <IconButton
            title="Obriši stavku"
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
