'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { useTransition } from 'react';
import { archiveClosedTimeSlotsAction } from './actions';

interface ArchiveClosedSlotsButtonProps {
    slotIds: number[];
}

export function ArchiveClosedSlotsButton({
    slotIds,
}: ArchiveClosedSlotsButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleArchiveAll = () => {
        startTransition(async () => {
            const result = await archiveClosedTimeSlotsAction(slotIds);
            if (!result.success) {
                alert(result.message);
            }
        });
    };

    return (
        <Button
            variant="outlined"
            color="neutral"
            onClick={handleArchiveAll}
            disabled={isPending || slotIds.length === 0}
            loading={isPending}
        >
            Arhiviraj sve zatvorene ({slotIds.length})
        </Button>
    );
}
