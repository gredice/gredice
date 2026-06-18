import type { OperationData } from '@gredice/client';
import { formatPrice } from '@gredice/js/currency';
import { getHarvestOperationRemovalDisclaimer } from '@gredice/js/plants';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Calendar } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { formatLocalDate } from '../RaisedBedPlantPicker';
import { RaisedBedWateringCalendar } from '../RaisedBedWateringCalendar';

export function OperationScheduleModal({
    gardenId,
    operation,
    onConfirm,
    raisedBedId,
    trigger,
}: {
    gardenId?: number;
    operation: OperationData;
    onConfirm: (date: Date) => Promise<void>;
    raisedBedId?: number;
    trigger: React.ReactElement;
}) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [scheduledDateInput, setScheduledDateInput] = useState<string | null>(
        null,
    );

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const date = formData.get('scheduledDate');
        if (typeof date === 'string' && date) {
            const scheduledDate = new Date(date);
            setErrorMessage(null);
            setIsLoading(true);
            try {
                await onConfirm(scheduledDate);
                setOpen(false);
            } catch {
                setErrorMessage('Zakazivanje nije uspjelo. Pokušaj ponovno.');
            } finally {
                setIsLoading(false);
            }
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
    const selectedDateInput = scheduledDateInput ?? operationDefaultDate;
    const selectedDate = selectedDateInput ? new Date(selectedDateInput) : null;
    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);
    const isHarvestOperation =
        operation.attributes.stage.information?.name === 'harvest';
    const harvestPlantRemovalDescription = isHarvestOperation
        ? getHarvestOperationRemovalDisclaimer(
              operation.actions?.removePlant,
              true,
          )
        : null;

    return (
        <Modal
            className="border border-tertiary border-b-4"
            trigger={trigger}
            title={`Zakaži radnju: ${operation.information.label}`}
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    setErrorMessage(null);
                    setScheduledDateInput(null);
                }
            }}
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={4}>
                    <Typography level="h5">Zakazivanje radnje</Typography>
                    <Typography>
                        Ova radnja će biti zakazana za odabrani datum.
                    </Typography>
                    <Card>
                        <CardContent noHeader>
                            <Row spacing={4}>
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
                                    {harvestPlantRemovalDescription && (
                                        <Typography
                                            level="body2"
                                            className="text-muted-foreground"
                                        >
                                            {harvestPlantRemovalDescription}
                                        </Typography>
                                    )}
                                    <Typography level="body2" semiBold>
                                        {formatPrice(
                                            operation.prices?.perOperation,
                                        )}
                                    </Typography>
                                </Stack>
                            </Row>
                        </CardContent>
                    </Card>
                    {errorMessage ? (
                        <Alert color="danger">
                            <Typography level="body2">
                                {errorMessage}
                            </Typography>
                        </Alert>
                    ) : null}
                    <Input
                        type="date"
                        label="Željeni datum radnje"
                        name="scheduledDate"
                        className="w-full bg-card"
                        disabled={isLoading}
                        value={selectedDateInput}
                        min={min}
                        max={max}
                        onChange={(event) =>
                            setScheduledDateInput(event.target.value)
                        }
                        required
                    />
                    {gardenId != null && raisedBedId != null ? (
                        <RaisedBedWateringCalendar
                            className="shadow-none"
                            gardenId={gardenId}
                            previewDate={selectedDate}
                            previewOperation={operation}
                            raisedBedId={raisedBedId}
                        />
                    ) : null}
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
                            Potvrdi
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}
