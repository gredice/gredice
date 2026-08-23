'use client';

import type { SelectTimeSlot } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Timer } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { useActionState, useEffect, useState } from 'react';
import { updateTimeSlotCloseAtAction } from './actions';

type EditTimeSlotCloseAtModalProps = {
    slot: SelectTimeSlot;
};

function formatDateTimeLocalValue(value: Date | string | null | undefined) {
    if (!value) {
        return '';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const pad = (part: number) => String(part).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EditTimeSlotCloseAtModal({
    slot,
}: EditTimeSlotCloseAtModalProps) {
    const [state, formAction, pending] = useActionState(
        updateTimeSlotCloseAtAction,
        null,
    );
    const [open, setOpen] = useState(false);
    const [timeZone, setTimeZone] = useState('Europe/Zagreb');
    const [closesAt, setClosesAt] = useState(
        formatDateTimeLocalValue(slot.closesAt),
    );

    useEffect(() => {
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }, []);

    useEffect(() => {
        setClosesAt(formatDateTimeLocalValue(slot.closesAt));
    }, [slot.closesAt]);

    return (
        <Modal
            trigger={
                <IconButton
                    title="Uredi zatvaranje"
                    variant="outlined"
                    size="sm"
                >
                    <Timer />
                </IconButton>
            }
            title="Uredi zatvaranje slota"
            open={open}
            onOpenChange={setOpen}
            className="md:max-w-md"
        >
            <form action={formAction}>
                <Stack spacing={6}>
                    <input type="hidden" name="slotId" value={slot.id} />
                    <input type="hidden" name="timeZone" value={timeZone} />

                    <Input
                        type="datetime-local"
                        name="closesAt"
                        label="Zatvara se"
                        value={closesAt}
                        onChange={(event) => setClosesAt(event.target.value)}
                        helperText="Prazno koristi zadano automatsko zatvaranje"
                    />

                    <Row spacing={3} justifyContent="space-between">
                        <Button
                            type="button"
                            variant="outlined"
                            color="neutral"
                            onClick={() => setClosesAt('')}
                            disabled={pending}
                        >
                            Koristi zadano
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending ? 'Spremanje...' : 'Spremi'}
                        </Button>
                    </Row>

                    {state?.message && (
                        <div
                            className={`text-sm ${state.success ? 'text-green-600' : 'text-red-600'}`}
                        >
                            {state.message}
                        </div>
                    )}
                </Stack>
            </form>
        </Modal>
    );
}
