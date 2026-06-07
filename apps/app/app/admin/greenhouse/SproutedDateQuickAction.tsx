'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Check } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { raisedBedFieldUpdatePlant } from '../../(actions)/raisedBedFieldsActions';

function formatDateInputValue(value: Date | string | null | undefined) {
    if (!value) {
        return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function dateInputToTimestamp(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);

    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    return date.toISOString();
}

export function SproutedDateQuickAction({
    raisedBedId,
    positionIndex,
    sproutedDate,
}: {
    raisedBedId: number;
    positionIndex: number;
    sproutedDate: Date | null;
}) {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(
        formatDateInputValue(sproutedDate),
    );
    const [isPending, startTransition] = useTransition();
    const dateChanged = selectedDate !== formatDateInputValue(sproutedDate);

    useEffect(() => {
        setSelectedDate(formatDateInputValue(sproutedDate));
    }, [sproutedDate]);

    function handleSave() {
        const timestamp = dateInputToTimestamp(selectedDate);
        if (!timestamp) {
            return;
        }

        startTransition(async () => {
            try {
                await raisedBedFieldUpdatePlant({
                    raisedBedId,
                    positionIndex,
                    status: 'sprouted',
                    timestamp,
                });
                router.refresh();
            } catch (error) {
                console.error('Error updating sprouted date:', error);
                alert(
                    error instanceof Error
                        ? error.message
                        : 'Spremanje datuma klijanja nije uspjelo.',
                );
            }
        });
    }

    return (
        <Row spacing={1} className="items-center">
            <Input
                aria-label="Datum klijanja"
                className="h-8 w-36"
                disabled={isPending}
                name={`sproutedDate-${raisedBedId}-${positionIndex}`}
                onChange={(event) => setSelectedDate(event.target.value)}
                type="date"
                value={selectedDate}
            />
            <Button
                aria-label="Spremi datum klijanja"
                color="success"
                disabled={!selectedDate || isPending || !dateChanged}
                loading={isPending}
                onClick={handleSave}
                size="sm"
                startDecorator={<Check className="size-4 shrink-0" />}
                title="Spremi datum klijanja i označi biljku kao proklijalu"
                variant="outlined"
            >
                Spremi
            </Button>
        </Row>
    );
}
