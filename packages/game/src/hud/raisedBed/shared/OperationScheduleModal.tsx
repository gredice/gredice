import type { OperationData } from '@gredice/client';
import { formatPrice } from '@gredice/js/currency';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Calendar } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { formatLocalDate } from '../RaisedBedPlantPicker';

export function OperationScheduleModal({
    operation,
    onConfirm,
    trigger,
}: {
    operation: OperationData;
    onConfirm: (date: Date) => Promise<void>;
    trigger: React.ReactElement;
}) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const date = formData.get('scheduledDate') as string;
        if (date) {
            const scheduledDate = new Date(date);
            setIsLoading(true);
            await onConfirm(scheduledDate);
            setOpen(false);
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
    const operationDefaultDate = formatLocalDate(tomorrow);
    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);

    return (
        <Modal
            className="border border-tertiary border-b-4"
            trigger={trigger}
            title={`Zakaži radnju: ${operation.information.label}`}
            open={open}
            onOpenChange={setOpen}
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="h5">Zakazivanje radnje</Typography>
                    <Typography>
                        Ova radnja će biti zakazana za odabrani datum.
                    </Typography>
                    <Card>
                        <CardContent noHeader>
                            <Row spacing={2}>
                                <div>
                                    <OperationImage
                                        operation={operation}
                                        size={32}
                                    />
                                </div>
                                <Stack>
                                    <Typography noWrap>
                                        {operation.information.label}
                                    </Typography>
                                    <Typography level="body2">
                                        {operation.information.shortDescription}
                                    </Typography>
                                    <Typography level="body2" semiBold>
                                        {formatPrice(
                                            operation.prices?.perOperation,
                                        )}
                                    </Typography>
                                </Stack>
                            </Row>
                        </CardContent>
                    </Card>
                    <Input
                        type="date"
                        label="Željeni datum radnje"
                        name="scheduledDate"
                        className="w-full bg-card"
                        disabled={isLoading}
                        defaultValue={operationDefaultDate}
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
                            Potvrdi
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}
