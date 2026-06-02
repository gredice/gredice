'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Calendar } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { cx } from '@gredice/ui/utils';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { raisedBedFieldUpdatePlant } from '../../app/(actions)/raisedBedFieldsActions';
import { raisedBedFieldPlantStatusItems } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantStatusSelector';

type RaisedBedFieldStatusDateChipProps = {
    raisedBedId: number;
    positionIndex: number;
    status: string;
    date: string | null;
    className?: string;
};

function parseDate(value: string | null) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

function formatLocalDateInput(value: string | null) {
    const date = parseDate(value);
    if (!date) {
        return '';
    }

    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function formatDateInputValue(date: Date) {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function formatShortDate(value: string | null) {
    const date = parseDate(value);
    if (!date) {
        return 'Datum';
    }

    return new Intl.DateTimeFormat('hr-HR', {
        day: '2-digit',
        month: '2-digit',
    }).format(date);
}

function dateInputToTimestamp(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);

    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    return date.toISOString();
}

export function RaisedBedFieldStatusDateChip({
    raisedBedId,
    positionIndex,
    status,
    date,
    className,
}: RaisedBedFieldStatusDateChipProps) {
    const [open, setOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState(status);
    const [selectedDate, setSelectedDate] = useState(
        formatLocalDateInput(date),
    );
    const [isPending, startTransition] = useTransition();
    const [mounted, setMounted] = useState(false);
    const statusItem = useMemo(
        () =>
            raisedBedFieldPlantStatusItems.find(
                (item) => item.value === status,
            ) ?? { value: status, label: status, icon: '' },
        [status],
    );

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setSelectedStatus(status);
        setSelectedDate(formatLocalDateInput(date));
    }, [date, status]);

    function resetForm() {
        setSelectedStatus(status);
        setSelectedDate(formatLocalDateInput(date));
    }

    function handleOpenChange(nextOpen: boolean) {
        if (nextOpen) {
            resetForm();
        }
        setOpen(nextOpen);
    }

    function handleSave() {
        startTransition(async () => {
            await raisedBedFieldUpdatePlant({
                raisedBedId,
                positionIndex,
                status: selectedStatus,
                timestamp: selectedDate
                    ? dateInputToTimestamp(selectedDate)
                    : undefined,
            });
            setOpen(false);
        });
    }

    function handleStatusChange(nextStatus: string) {
        setSelectedStatus(nextStatus);
        setSelectedDate(
            nextStatus === status
                ? formatLocalDateInput(date)
                : formatDateInputValue(new Date()),
        );
    }

    const dateLabel = mounted ? formatShortDate(date) : '...';

    return (
        <Popper
            open={open}
            onOpenChange={handleOpenChange}
            align="start"
            className="w-72 p-3"
            side="bottom"
            trigger={
                <Button
                    color="neutral"
                    size="sm"
                    title="Promijeni stanje i datum biljke"
                    variant="plain"
                    className={cx(
                        'h-8 w-full justify-start px-2 text-foreground',
                        className,
                    )}
                    startDecorator={
                        <span aria-hidden="true">{statusItem.icon}</span>
                    }
                    endDecorator={
                        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                            <Calendar className="size-3.5 shrink-0" />
                            <span>{dateLabel}</span>
                        </span>
                    }
                >
                    <span className="min-w-0 truncate">{statusItem.label}</span>
                </Button>
            }
        >
            <Stack spacing={3}>
                <SelectItems
                    label="Stanje"
                    value={selectedStatus}
                    onValueChange={handleStatusChange}
                    items={raisedBedFieldPlantStatusItems}
                />
                <Input
                    fullWidth
                    label="Datum"
                    name="plantStatusDate"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                />
                <Button
                    fullWidth
                    size="sm"
                    loading={isPending}
                    disabled={isPending}
                    onClick={handleSave}
                >
                    Spremi
                </Button>
            </Stack>
        </Popper>
    );
}
