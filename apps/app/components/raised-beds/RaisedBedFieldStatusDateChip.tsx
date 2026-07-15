'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Calendar } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { raisedBedFieldUpdatePlant } from '../../app/(actions)/raisedBedFieldsActions';
import { raisedBedFieldPlantStatusItems } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantStatusSelector';
import { canUpdatePlantingTaskStatus } from '../../app/admin/schedule/scheduleShared';
import type { RaisedBedFieldDateItem } from './RaisedBedFieldDatesPopover';

type RaisedBedFieldStatusDateChipProps = {
    raisedBedId: number;
    positionIndex: number;
    status: string;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    date: string | null;
    dateItems?: RaisedBedFieldDateItem[];
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

function formatShortDate(value: string | null, fallback = 'Datum') {
    const date = parseDate(value);
    if (!date) {
        return fallback;
    }

    const currentYear = new Date().getFullYear();
    const format: Intl.DateTimeFormatOptions =
        date.getFullYear() === currentYear
            ? { day: '2-digit', month: '2-digit' }
            : { day: '2-digit', month: '2-digit', year: 'numeric' };

    return new Intl.DateTimeFormat('hr-HR', format).format(date);
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
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    expectedPlantSortId,
    date,
    dateItems = [],
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
            try {
                await raisedBedFieldUpdatePlant({
                    raisedBedId,
                    positionIndex,
                    status: selectedStatus,
                    expectedPlantCycleEventId,
                    expectedPlantCycleVersionEventId,
                    expectedPlantSortId,
                    timestamp: selectedDate
                        ? dateInputToTimestamp(selectedDate)
                        : undefined,
                });
                setOpen(false);
            } catch (error) {
                console.error('Error updating plant status date:', error);
                alert(
                    error instanceof Error
                        ? error.message
                        : 'Spremanje stanja biljke nije uspjelo.',
                );
            }
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
            className="w-80 max-w-[calc(100vw-2rem)] p-3"
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
                    items={raisedBedFieldPlantStatusItems.filter((item) =>
                        canUpdatePlantingTaskStatus(status, item.value),
                    )}
                />
                <Input
                    fullWidth
                    label="Datum"
                    name="plantStatusDate"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                />
                {dateItems.length > 0 && (
                    <div className="rounded-md border bg-muted/20 p-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5">
                            {dateItems.map((item) => (
                                <div
                                    className="contents"
                                    key={`${item.key}-${item.label}`}
                                >
                                    <Typography
                                        level="body3"
                                        className={cx(
                                            'min-w-0 truncate',
                                            item.current
                                                ? 'font-medium text-foreground'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {item.label}
                                    </Typography>
                                    <Typography
                                        level="body3"
                                        className={cx(
                                            'text-right tabular-nums',
                                            item.current
                                                ? 'font-medium text-foreground'
                                                : item.value
                                                  ? 'text-foreground'
                                                  : 'text-muted-foreground',
                                        )}
                                        title={item.value ?? undefined}
                                    >
                                        {item.value
                                            ? mounted
                                                ? formatShortDate(
                                                      item.value,
                                                      '-',
                                                  )
                                                : '...'
                                            : '-'}
                                    </Typography>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
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
