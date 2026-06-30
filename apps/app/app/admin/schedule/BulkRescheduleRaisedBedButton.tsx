'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Calendar } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { rescheduleOperationAction } from '../../(actions)/operationActions';
import { rescheduleRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';

type FieldRescheduleTarget = {
    id?: number;
    raisedBedId: number;
    positionIndex: number;
};

type OperationRescheduleTarget = {
    id: number;
};

interface BulkRescheduleRaisedBedButtonProps {
    physicalId: string;
    targetLabel?: string;
    fields: FieldRescheduleTarget[];
    operations: OperationRescheduleTarget[];
    onSubmit?: (scheduledDate: string) => unknown | Promise<unknown>;
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function BulkRescheduleRaisedBedButton({
    physicalId,
    targetLabel,
    fields,
    operations,
    onSubmit,
}: BulkRescheduleRaisedBedButtonProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalItems = fields.length + operations.length;
    const disabled = totalItems === 0 || isSubmitting;
    const targetText =
        targetLabel ??
        (physicalId === 'dan' ? 'za dan' : `za gredicu ${physicalId}`);

    const today = new Date();
    const threeMonthsFromToday = new Date(
        today.getFullYear(),
        today.getMonth() + 3,
        today.getDate(),
    );

    const min = formatLocalDate(today);
    const max = formatLocalDate(threeMonthsFromToday);

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

        if (onSubmit) {
            await onSubmit(scheduledDate);
            setOpen(false);
            return;
        }

        setIsSubmitting(true);
        setOpen(false);
        void Promise.all([
            ...fields.map((field) => {
                const targetFormData = new FormData();
                targetFormData.set('raisedBedId', field.raisedBedId.toString());
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
        ])
            .catch((error: unknown) => {
                console.error(
                    'Failed to reschedule all raised bed items:',
                    error,
                );
                alert('Skupno zakazivanje zadataka nije uspjelo.');
            })
            .finally(() => setIsSubmitting(false));
    }

    return (
        <Modal
            title="Skupno zakazivanje zadataka"
            open={open}
            onOpenChange={setOpen}
            trigger={
                <IconButton
                    variant="plain"
                    size="xs"
                    title="Zakaži sve nepotvrđene zadatke"
                    disabled={disabled}
                    aria-disabled={disabled}
                    loading={isSubmitting}
                >
                    <Calendar className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={4}>
                    <Typography level="h5">Skupno zakazivanje</Typography>
                    <Typography>
                        Odaberite datum za sve nepotvrđene zadatke ({totalItems}
                        ) {targetText}.
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

                    <Row spacing={2} justifyContent="end">
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
