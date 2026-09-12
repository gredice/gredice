import {
    plantFieldStatusLabel,
    userAllowedPlantStatusTransitions,
} from '@gredice/js/plants';
import { CalendarDatePicker } from '@gredice/ui/CalendarDatePicker';
import { GamePlantStatusIcon } from '@gredice/ui/GameIcons';
import { Calendar, Navigate } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type ReactNode, useCallback, useState } from 'react';
import { useRaisedBedFieldUpdateStatus } from '../../hooks/useRaisedBedFieldUpdateStatus';
import { formatLocalDate } from './RaisedBedPlantPicker';

function formatStatusChangeDate(date: string) {
    const [year, month, day] = date.split('-');
    if (!year || !month || !day) {
        return 'Odaberi datum';
    }

    return `${day}. ${month}. ${year}.`;
}

export function RaisedBedFieldStatusChange({
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    expectedPlantSortId,
    raisedBedId,
    positionIndex,
    currentStatus,
    trigger,
}: {
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
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
    const [statusToConfirm, setStatusToConfirm] = useState<string | null>(null);
    const [datePickerContainer, setDatePickerContainer] =
        useState<HTMLElement>();
    const [statusChangeBoundary, setStatusChangeBoundary] = useState<Element>();
    const handleDatePickerContainerRef = useCallback(
        (node: HTMLDivElement | null) => {
            setDatePickerContainer(node ?? undefined);
            // The popover is portaled inside the plant modal. Its menu must
            // fit that modal's clipping boundary, including the mobile drawer.
            const popover = node?.closest('[role="dialog"]');
            setStatusChangeBoundary(
                popover?.parentElement?.closest(
                    '[role="dialog"], [role="alertdialog"]',
                ) ?? undefined,
            );
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
            expectedPlantCycleEventId,
            expectedPlantCycleVersionEventId,
            expectedPlantSortId,
            raisedBedId,
            positionIndex,
            status: newStatus,
            timestamp,
        });
        setOpen(false);
        setStatusToConfirm(null);
    };

    const confirmedStatusInfo = statusToConfirm
        ? plantFieldStatusLabel(statusToConfirm)
        : null;

    return (
        <Popper
            open={open}
            onOpenChange={setOpen}
            trigger={trigger}
            side="bottom"
            sideOffset={12}
            collisionBoundary={statusChangeBoundary}
            className="flex max-h-(--available-height) w-80 flex-col border-tertiary border-b-4 p-4"
        >
            <Stack spacing={4} className="relative min-h-0">
                <Row
                    className="shrink-0"
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
                        <CalendarDatePicker
                            open={datePickerOpen}
                            onOpenChange={setDatePickerOpen}
                            side="bottom"
                            align="end"
                            max={formatLocalDate(new Date())}
                            name="statusChangeDate"
                            onValueChange={setSelectedDate}
                            popoverContainer={datePickerContainer}
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
                            value={selectedDate}
                        />
                    )}
                </Row>
                {hasAllowedNextStatuses ? (
                    <List
                        variant="outlined"
                        className="min-h-0 overflow-y-auto overscroll-contain bg-card"
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
                                    onSelected={(nextStatus) => {
                                        setStatusToConfirm(nextStatus);
                                    }}
                                    className="py-3 pr-4"
                                    startDecorator={
                                        <GamePlantStatusIcon
                                            status={nextStatus}
                                            className="size-7 shrink-0"
                                            aria-hidden="true"
                                        />
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
                            <GamePlantStatusIcon
                                status={currentStatus}
                                className="size-7 shrink-0"
                                aria-hidden="true"
                            />
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
            <ModalConfirm
                open={Boolean(statusToConfirm)}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setStatusToConfirm(null);
                    }
                }}
                title="Potvrda promjene stanja biljke"
                header="Potvrda promjene stanja"
                confirmLabel={
                    updateStatusMutation.isPending
                        ? 'Spremam...'
                        : 'Promijeni stanje'
                }
                cancelLabel="Odustani"
                onConfirm={() => {
                    if (statusToConfirm && !updateStatusMutation.isPending) {
                        void handleStatusChange(statusToConfirm);
                    }
                }}
            >
                {confirmedStatusInfo
                    ? `Jeste li sigurni da želite promijeniti stanje biljke u "${confirmedStatusInfo.shortLabel}"?`
                    : 'Jeste li sigurni da želite promijeniti stanje biljke?'}
            </ModalConfirm>
        </Popper>
    );
}
