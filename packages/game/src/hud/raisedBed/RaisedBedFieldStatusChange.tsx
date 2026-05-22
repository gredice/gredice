import {
    plantFieldStatusLabel,
    userAllowedPlantStatusTransitions,
} from '@gredice/js/plants';
import { Input } from '@gredice/ui/Input';
import { Calendar, Navigate } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type ReactNode, useCallback, useState } from 'react';
import { useRaisedBedFieldUpdateStatus } from '../../hooks/useRaisedBedFieldUpdateStatus';
import { plantFieldStatusEmoji } from './PlantFieldStatusEmoji';
import { formatLocalDate } from './RaisedBedPlantPicker';

function formatStatusChangeDate(date: string) {
    const [year, month, day] = date.split('-');
    if (!year || !month || !day) {
        return 'Odaberi datum';
    }

    return `${day}. ${month}. ${year}.`;
}

export function RaisedBedFieldStatusChange({
    raisedBedId,
    positionIndex,
    currentStatus,
    trigger,
}: {
    raisedBedId: number;
    positionIndex: number;
    currentStatus: string | undefined;
    trigger: ReactNode;
}) {
    const updateStatusMutation = useRaisedBedFieldUpdateStatus();
    const [selectedDate, setSelectedDate] = useState(
        formatLocalDate(new Date()),
    );
    const [open, setOpen] = useState(false);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [datePickerContainer, setDatePickerContainer] =
        useState<HTMLElement>();
    const handleDatePickerContainerRef = useCallback(
        (node: HTMLDivElement | null) => {
            setDatePickerContainer(node ?? undefined);
        },
        [],
    );

    const allowedNextStatuses = currentStatus
        ? userAllowedPlantStatusTransitions[currentStatus]
        : undefined;
    const hasAllowedNextStatuses = Boolean(allowedNextStatuses?.length);
    const currentStatusInfo = plantFieldStatusLabel(currentStatus);

    const isDateSelected = selectedDate.length > 0;
    const handleStatusChange = async (newStatus: string) => {
        if (!isDateSelected) {
            return;
        }

        const [year, month, day] = selectedDate.split('-').map(Number);
        const localDate = new Date(year, month - 1, day, 12, 0, 0);
        if (Number.isNaN(localDate.getTime())) {
            return;
        }

        const timestamp = localDate.toISOString();
        await updateStatusMutation.mutateAsync({
            raisedBedId,
            positionIndex,
            status: newStatus,
            timestamp,
        });
        setOpen(false);
    };

    return (
        <Popper
            open={open}
            onOpenChange={setOpen}
            trigger={trigger}
            side="bottom"
            sideOffset={12}
            className="w-80 border-tertiary border-b-4 p-4"
        >
            <Stack spacing={4} className="relative">
                <Row
                    spacing={2}
                    justifyContent="space-between"
                    alignItems="center"
                    ref={handleDatePickerContainerRef}
                >
                    <Typography level="body2" semiBold>
                        {hasAllowedNextStatuses
                            ? 'Promijeni stanje'
                            : 'Stanje biljke'}
                    </Typography>
                    {hasAllowedNextStatuses && (
                        <Popper
                            open={datePickerOpen}
                            onOpenChange={setDatePickerOpen}
                            side="bottom"
                            align="end"
                            sideOffset={8}
                            container={datePickerContainer}
                            className="w-72 p-3"
                            trigger={
                                <button
                                    type="button"
                                    title="Odaberi datum promjene"
                                    aria-label={`Odaberi datum promjene: ${formatStatusChangeDate(selectedDate)}`}
                                    className="inline-flex items-center gap-1 rounded-xl border bg-card px-1.5 py-0.5 text-xs text-foreground/80 transition-colors hover:bg-card-foreground/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2"
                                >
                                    <Calendar
                                        className="size-3.5 shrink-0"
                                        aria-hidden="true"
                                    />
                                    {formatStatusChangeDate(selectedDate)}
                                </button>
                            }
                        >
                            <Input
                                type="date"
                                label="Datum promjene"
                                name="statusChangeDate"
                                className="w-full bg-card"
                                value={selectedDate}
                                onChange={(e) => {
                                    setSelectedDate(e.target.value);
                                    setDatePickerOpen(false);
                                }}
                                max={formatLocalDate(new Date())}
                                required
                            />
                        </Popper>
                    )}
                </Row>
                {hasAllowedNextStatuses ? (
                    <List
                        variant="outlined"
                        className="bg-card overflow-hidden"
                    >
                        {allowedNextStatuses?.map((nextStatus) => {
                            const statusInfo =
                                plantFieldStatusLabel(nextStatus);
                            return (
                                <ListItem
                                    key={nextStatus}
                                    nodeId={nextStatus}
                                    variant="outlined"
                                    disabled={
                                        updateStatusMutation.isPending ||
                                        !isDateSelected
                                    }
                                    onSelected={handleStatusChange}
                                    className="py-3 pr-4"
                                    startDecorator={
                                        <span
                                            className="w-8 text-center text-lg leading-none"
                                            aria-hidden="true"
                                        >
                                            {plantFieldStatusEmoji(nextStatus)}
                                        </span>
                                    }
                                    endDecorator={
                                        <Navigate
                                            className="size-4 shrink-0"
                                            aria-hidden="true"
                                        />
                                    }
                                    label={
                                        <Typography
                                            level="body1"
                                            semiBold
                                            className="text-center"
                                        >
                                            {statusInfo.shortLabel}
                                        </Typography>
                                    }
                                />
                            );
                        })}
                    </List>
                ) : (
                    <Stack spacing={2}>
                        <Row spacing={2} alignItems="center">
                            <span
                                className="text-xl leading-none"
                                aria-hidden="true"
                            >
                                {plantFieldStatusEmoji(currentStatus)}
                            </span>
                            <Typography level="body1" semiBold>
                                {currentStatusInfo.shortLabel}
                            </Typography>
                        </Row>
                        <Typography level="body2" secondary>
                            Biljka je trenutno u stanju:{' '}
                            {currentStatusInfo.shortLabel}. Stanje se ne može
                            promijeniti u ovom trenutku.
                        </Typography>
                    </Stack>
                )}
            </Stack>
        </Popper>
    );
}
