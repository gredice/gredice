"use client";

import { useState } from "react";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Button } from "@signalco/ui-primitives/Button";
import { Input } from "@signalco/ui-primitives/Input";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Calendar } from "@signalco/ui-icons";
import { rescheduleOperationAction } from "../../(actions)/operationActions";

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

interface RescheduleOperationModalProps {
    operation: {
        id: number;
        entityId: number;
        scheduledDate?: Date;
    };
    operationLabel: string;
    trigger: React.ReactElement;
}

export function RescheduleOperationModal({
    operation,
    operationLabel,
    trigger
}: RescheduleOperationModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const isRescheduling = !!operation.scheduledDate;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        setIsLoading(true);
        try {
            await rescheduleOperationAction(formData);
            setOpen(false);
        } catch (error) {
            console.error('Error rescheduling operation:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const threeMonthsFromTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth() + 3, tomorrow.getDate());

    const currentScheduledDate = operation.scheduledDate
        ? formatLocalDate(operation.scheduledDate)
        : formatLocalDate(tomorrow);
    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);

    return (
        <Modal
            className="border border-tertiary border-b-4"
            trigger={trigger}
            title={`${isRescheduling ? 'Prerasporedi' : 'Zakaži'}: ${operationLabel}`}
            open={open}
            onOpenChange={setOpen}>
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="h5">
                        {isRescheduling ? 'Preraspoređivanje operacije' : 'Zakazivanje operacije'}
                    </Typography>
                    <Typography>
                        Operacija će biti {isRescheduling ? 'preraspoređena' : 'zakazana'} na odabrani datum.
                    </Typography>

                    <input type="hidden" name="operationId" value={operation.id} />

                    <Input
                        type="date"
                        label={isRescheduling ? "Novi datum operacije" : "Datum operacije"}
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
                            startDecorator={<Calendar className="size-5 shrink-0" />}
                        >
                            {isRescheduling ? 'Prerasporedi' : 'Zakaži'}
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}
