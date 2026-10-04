'use client';

import type { SelectTimeSlot } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Close } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { useTransition } from 'react';
import {
    archiveTimeSlotAction,
    closeTimeSlotAction,
    updateTimeSlotStatusAction,
} from './actions';
import { EditTimeSlotCloseAtModal } from './EditTimeSlotCloseAtModal';

interface SlotActionButtonsProps {
    slot: SelectTimeSlot;
}

export function SlotActionButtons({ slot }: SlotActionButtonsProps) {
    const [isPending, startTransition] = useTransition();

    const handleCloseSlot = () => {
        startTransition(async () => {
            const result = await closeTimeSlotAction(slot.id);
            if (!result.success) {
                alert(result.message);
            }
        });
    };

    const handleArchiveSlot = () => {
        startTransition(async () => {
            const result = await archiveTimeSlotAction(slot.id);
            if (!result.success) {
                alert(result.message);
            }
        });
    };

    const handleReopenSlot = () => {
        startTransition(async () => {
            const result = await updateTimeSlotStatusAction(
                slot.id,
                'scheduled',
            );
            if (!result.success) {
                alert(result.message);
            }
        });
    };

    const isScheduled = slot.status === 'scheduled';
    const isClosed = slot.status === 'closed';
    const isPastSlot = new Date(slot.endAt) < new Date();

    return (
        <Row spacing={2}>
            <EditTimeSlotCloseAtModal slot={slot} />

            {isScheduled && (
                <IconButton
                    title="Zatvori"
                    variant="outlined"
                    size="sm"
                    onClick={handleCloseSlot}
                    disabled={isPending}
                >
                    <Close />
                </IconButton>
            )}

            {isClosed && (
                <Button
                    variant="outlined"
                    size="sm"
                    color="primary"
                    onClick={handleReopenSlot}
                    disabled={isPending}
                >
                    Otvori
                </Button>
            )}

            {(isScheduled || isClosed) && isPastSlot && (
                <Button
                    variant="outlined"
                    size="sm"
                    color="neutral"
                    onClick={handleArchiveSlot}
                    disabled={isPending}
                >
                    Arhiviraj
                </Button>
            )}
        </Row>
    );
}
