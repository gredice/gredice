'use client';

import { Row } from "@signalco/ui-primitives/Row";
import { Button } from "@signalco/ui-primitives/Button";
import { SelectTimeSlot } from "@gredice/storage";
import { closeTimeSlotAction, archiveTimeSlotAction, updateTimeSlotStatusAction } from "./actions";
import { useTransition } from "react";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Close } from "@signalco/ui-icons";

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
            const result = await updateTimeSlotStatusAction(slot.id, 'scheduled');
            if (!result.success) {
                alert(result.message);
            }
        });
    };

    const isScheduled = slot.status === 'scheduled';
    const isClosed = slot.status === 'closed';
    const isArchived = slot.status === 'archived';
    const isPastSlot = new Date(slot.endAt) < new Date();

    return (
        <Row spacing={1}>
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
