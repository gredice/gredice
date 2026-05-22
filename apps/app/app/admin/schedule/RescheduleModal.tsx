'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Calendar } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
    onSubmit: (formData: FormData) => unknown | Promise<unknown>;
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
            alert('Zakazivanje zadatka nije uspjelo. Pokušajte ponovno.');
        } finally {
            setIsLoading(false);
        }
    }

    const today = new Date();
    const threeMonthsFromToday = new Date(
        today.getFullYear(),
        today.getMonth() + 3,
        today.getDate(),
    );

    const min = formatLocalDate(today);
    const currentScheduledDate =
        scheduledDate && formatLocalDate(scheduledDate) >= min
            ? formatLocalDate(scheduledDate)
            : min;
    const max = formatLocalDate(threeMonthsFromToday);

    return (
        <Modal
            trigger={trigger}
            title={`${isRescheduling ? 'Prerasporedi' : 'Zakaži'}: ${label}`}
            open={open}
            onOpenChange={setOpen}
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={4}>
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

                    <Row spacing={2}>
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
