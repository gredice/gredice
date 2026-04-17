'use client';

import { Calendar } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { rescheduleOperationAction } from '../../(actions)/operationActions';
import { rescheduleRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';

type FieldRescheduleTarget = {
    raisedBedId: number;
    positionIndex: number;
};

type OperationRescheduleTarget = {
    id: number;
};

interface BulkRescheduleRaisedBedButtonProps {
    physicalId: string;
    fields: FieldRescheduleTarget[];
    operations: OperationRescheduleTarget[];
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function BulkRescheduleRaisedBedButton({
    physicalId,
    fields,
    operations,
}: BulkRescheduleRaisedBedButtonProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalItems = fields.length + operations.length;
    const disabled = totalItems === 0 || isSubmitting;

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

    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (totalItems === 0) {
            return;
        }

        const formData = new FormData(event.currentTarget);
        const scheduledDate = formData.get('scheduledDate') as string;

        if (!scheduledDate) {
            return;
        }

        setIsSubmitting(true);
        try {
            await Promise.all([
                ...fields.map((field) => {
                    const targetFormData = new FormData();
                    targetFormData.set(
                        'raisedBedId',
                        field.raisedBedId.toString(),
                    );
                    targetFormData.set(
                        'positionIndex',
                        field.positionIndex.toString(),
                    );
                    targetFormData.set('scheduledDate', scheduledDate);
                    return rescheduleRaisedBedFieldAction(targetFormData);
                }),
                ...operations.map((operation) => {
                    const targetFormData = new FormData();
                    targetFormData.set('operationId', operation.id.toString());
                    targetFormData.set('scheduledDate', scheduledDate);
                    return rescheduleOperationAction(targetFormData);
                }),
            ]);
            setOpen(false);
        } catch (error) {
            console.error('Failed to reschedule all raised bed items:', error);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Modal
            title="Skupno zakazivanje zadataka"
            open={open}
            onOpenChange={setOpen}
            trigger={
                <IconButton
                    variant="plain"
                    title="Zakaži sve nepotvrđene zadatke gredice"
                    disabled={disabled}
                    aria-disabled={disabled}
                    loading={isSubmitting}
                >
                    <Calendar className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="h5">Skupno zakazivanje</Typography>
                    <Typography>
                        Odaberite datum za sve nepotvrđene zadatke ({totalItems}
                        ) za gredicu <strong>{physicalId}</strong>.
                    </Typography>

                    <Input
                        type="date"
                        name="scheduledDate"
                        label="Datum"
                        className="w-full bg-card"
                        min={min}
                        max={max}
                        required
                        defaultValue={min}
                        disabled={isSubmitting}
                    />

                    <Row spacing={1} justifyContent="end">
                        <Button
                            variant="outlined"
                            onClick={() => setOpen(false)}
                            disabled={isSubmitting}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            variant="solid"
                            loading={isSubmitting}
                            disabled={isSubmitting}
                            startDecorator={
                                <Calendar className="size-5 shrink-0" />
                            }
                        >
                            Zakaži sve
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}

export default BulkRescheduleRaisedBedButton;
