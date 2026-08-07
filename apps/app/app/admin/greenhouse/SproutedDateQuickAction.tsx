'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { updateGreenhouseSproutedDateAction } from './actions';
import {
    dateInputToTimestamp,
    getSproutedDateInputError,
} from './sproutedDateInput';

function formatDateInputValue(value: Date | string | null | undefined) {
    const date = value
        ? value instanceof Date
            ? value
            : new Date(value)
        : new Date();
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function SproutedDateQuickAction({
    raisedBedId,
    positionIndex,
    sproutedDate,
    minimumDate,
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    expectedPlantSortId,
}: {
    raisedBedId: number;
    positionIndex: number;
    sproutedDate: Date | null;
    minimumDate: Date;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(
        formatDateInputValue(sproutedDate),
    );
    const [isPending, startTransition] = useTransition();
    const minimumDateInputValue = formatDateInputValue(minimumDate);
    const maximumDateInputValue = formatDateInputValue(null);

    useEffect(() => {
        setSelectedDate(formatDateInputValue(sproutedDate));
    }, [sproutedDate]);

    function handleOpenChange(nextOpen: boolean) {
        if (nextOpen) {
            setSelectedDate(formatDateInputValue(sproutedDate));
        }
        setOpen(nextOpen);
    }

    function handleSave() {
        const validationError = getSproutedDateInputError({
            maximumDate: maximumDateInputValue,
            minimumDate: minimumDateInputValue,
            value: selectedDate,
        });
        if (validationError) {
            alert(validationError);
            return;
        }

        const timestamp = dateInputToTimestamp(selectedDate);
        if (!timestamp) {
            alert('Odaberi ispravan datum klijanja.');
            return;
        }

        startTransition(async () => {
            try {
                const result = await updateGreenhouseSproutedDateAction({
                    raisedBedId,
                    positionIndex,
                    expectedPlantCycleEventId,
                    expectedPlantCycleVersionEventId,
                    expectedPlantSortId,
                    timestamp,
                });
                if (!result.success) {
                    alert(result.message);
                    return;
                }
                setOpen(false);
                router.refresh();
            } catch (error) {
                console.error('Error updating sprouted date:', error);
                alert('Spremanje datuma klijanja nije uspjelo.');
            }
        });
    }

    return (
        <Popper
            open={open}
            onOpenChange={handleOpenChange}
            align="start"
            className="w-72 p-3"
            side="bottom"
            trigger={
                <Button
                    type="button"
                    aria-label="Promijeni datum klijanja"
                    color="neutral"
                    size="sm"
                    title="Promijeni datum klijanja"
                    variant="plain"
                    className="h-8 px-1 -mx-1"
                >
                    {sproutedDate ? (
                        <LocalDateTime time={false}>
                            {sproutedDate}
                        </LocalDateTime>
                    ) : (
                        <span className="text-muted-foreground">-</span>
                    )}
                </Button>
            }
        >
            <Stack spacing={3}>
                <Typography level="h5">Datum klijanja</Typography>
                <Input
                    fullWidth
                    aria-label="Datum klijanja"
                    disabled={isPending}
                    helperText="Datum mora biti na datum prethodnog stanja biljke ili kasnije, a najkasnije danas."
                    label="Proklijalo"
                    max={maximumDateInputValue}
                    min={minimumDateInputValue}
                    name={`sproutedDate-${raisedBedId}-${positionIndex}`}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    type="date"
                    value={selectedDate}
                />
                <Row spacing={2} className="justify-end">
                    <Button
                        type="button"
                        disabled={isPending}
                        onClick={() => setOpen(false)}
                        variant="plain"
                    >
                        Odustani
                    </Button>
                    <Button
                        type="button"
                        disabled={!selectedDate || isPending}
                        loading={isPending}
                        onClick={handleSave}
                    >
                        Spremi
                    </Button>
                </Row>
            </Stack>
        </Popper>
    );
}
