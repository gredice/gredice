'use client';

import { Calendar } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

interface RescheduleModalProps {
    label: string;
    scheduledDate?: Date;
    trigger: React.ReactElement;
    onSubmit: (formData: FormData) => Promise<void>;
    hiddenFields: React.ReactNode;
}

export function RescheduleModal({
    label,
    scheduledDate,
    trigger,
    onSubmit,
    hiddenFields,
}: RescheduleModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const isRescheduling = !!scheduledDate;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        setIsLoading(true);
        try {
            await onSubmit(formData);
            setOpen(false);
        } catch (error) {
            console.error('Error rescheduling item:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const today = new Date();
    const tomorrow = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
    );
    const threeMonthsFromTomorrow = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth() + 3,
        tomorrow.getDate(),
    );

    const currentScheduledDate = scheduledDate
        ? formatLocalDate(scheduledDate)
        : formatLocalDate(tomorrow);
    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);

    return (
        <Modal
            trigger={trigger}
            title={`${isRescheduling ? 'Prerasporedi' : 'Zakaži'}: ${label}`}
            open={open}
            onOpenChange={setOpen}
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="h5">
                        {isRescheduling
                            ? 'Preraspoređivanje zadatka'
                            : 'Zakazivanje zadatka'}
                    </Typography>
                    <Typography>
                        Zadatak će biti{' '}
                        {isRescheduling ? 'preraspoređen' : 'zakazan'} na
                        odabrani datum.
                    </Typography>

                    {hiddenFields}

                    <Input
                        type="date"
                        label={isRescheduling ? 'Novi datum' : 'Datum'}
                        name="scheduledDate"
                        className="w-full bg-card"
                        disabled={isLoading}
                        defaultValue={currentScheduledDate}
                        min={min}
                        max={max}
                        required
                    />

                    <Row spacing={1}>
                        <Button
                            variant="plain"
                            onClick={() => setOpen(false)}
                            disabled={isLoading}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            variant="solid"
                            disabled={isLoading}
                            loading={isLoading}
                            startDecorator={
                                <Calendar className="size-5 shrink-0" />
                            }
                        >
                            {isRescheduling ? 'Prerasporedi' : 'Zakaži'}
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}

export default RescheduleModal;
