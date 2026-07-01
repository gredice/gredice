import type { OperationData } from '@gredice/client';
import { formatPrice } from '@gredice/js/currency';
import { getHarvestOperationRemovalDisclaimer } from '@gredice/js/plants';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { EventCalendar } from '@gredice/ui/EventCalendar';
import { Calendar } from '@gredice/ui/icons';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { useLiveTime } from '../../../hooks/useLiveTime';
import { GameModal } from '../../../shared-ui/game-modal';
import { formatLocalDate } from '../RaisedBedPlantPicker';
import {
    isWateringOperation,
    RaisedBedWateringCalendar,
} from '../RaisedBedWateringCalendar';
import { OperationScheduleCalendar } from './OperationScheduleCalendar';

function parseLocalDateInput(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
        return null;
    }

    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function OperationScheduleModal({
    gardenId,
    operation,
    onConfirm,
    positionIndex,
    raisedBedId,
    showHistory = true,
    trigger,
}: {
    gardenId: number;
    operation: OperationData;
    onConfirm: (date: Date) => Promise<void>;
    positionIndex?: number;
    raisedBedId?: number;
    showHistory?: boolean;
    trigger: React.ReactElement;
}) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [scheduledDateInput, setScheduledDateInput] = useState<string | null>(
        null,
    );

    const today = useLiveTime();
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
    const selectedDate = parseLocalDateInput(selectedDateInput);
    const showWateringCalendar =
        raisedBedId != null && isWateringOperation(operation);
    const isHarvestOperation =
        operation.attributes.stage.information?.name === 'harvest';
    const harvestPlantRemovalDescription = isHarvestOperation
        ? getHarvestOperationRemovalDisclaimer(
              operation.actions?.removePlant,
              true,
          )
        : null;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const scheduledDate = new Date(selectedDateInput);
        if (Number.isNaN(scheduledDate.getTime())) {
            setErrorMessage('Odaberi datum radnje.');
            return;
        }

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

    const handleDateSelect = (date: Date) => {
        setScheduledDateInput(formatLocalDate(date));
    };

    return (
        <GameModal
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
                    <Typography level="body2" semiBold>
                        Zakazivanje radnje
                    </Typography>
                    <Typography level="body2" secondary>
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
                    {open && showWateringCalendar ? (
                        <RaisedBedWateringCalendar
                            className="shadow-none"
                            gardenId={gardenId}
                            maxSelectableDate={threeMonthsFromTomorrow}
                            minSelectableDate={tomorrow}
                            onDateSelect={handleDateSelect}
                            previewDate={selectedDate}
                            previewOperation={operation}
                            raisedBedId={raisedBedId}
                            referenceDate={today}
                            selectedDate={selectedDate}
                            visibleFrom={tomorrow}
                            visibleTo={threeMonthsFromTomorrow}
                        />
                    ) : null}
                    {open && !showWateringCalendar && showHistory ? (
                        <OperationScheduleCalendar
                            className="shadow-none"
                            gardenId={gardenId}
                            maxSelectableDate={threeMonthsFromTomorrow}
                            minSelectableDate={tomorrow}
                            onDateSelect={handleDateSelect}
                            operation={operation}
                            positionIndex={positionIndex}
                            previewDate={selectedDate}
                            raisedBedId={raisedBedId}
                            referenceDate={today}
                            selectedDate={selectedDate}
                            visibleFrom={tomorrow}
                            visibleTo={threeMonthsFromTomorrow}
                        />
                    ) : null}
                    {open && !showWateringCalendar && !showHistory ? (
                        <EventCalendar
                            className="shadow-none"
                            emptyLabel={null}
                            entries={[]}
                            maxSelectableDate={threeMonthsFromTomorrow}
                            minSelectableDate={tomorrow}
                            onDateSelect={handleDateSelect}
                            referenceDate={today}
                            selectedDate={selectedDate}
                            visibleFrom={tomorrow}
                            visibleTo={threeMonthsFromTomorrow}
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
        </GameModal>
    );
}
