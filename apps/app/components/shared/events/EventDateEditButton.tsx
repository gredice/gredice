'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState, useTransition } from 'react';

function toDateTimeLocalValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

export interface EventDateEditButtonProps {
    date: Date;
    onSave: (
        isoDate: string,
    ) => Promise<{ success: boolean; error?: string } | undefined>;
}

export function EventDateEditButton({
    date,
    onSave,
}: EventDateEditButtonProps) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(() => toDateTimeLocalValue(date));
    const [isPending, startTransition] = useTransition();

    const handleOpenChange = (next: boolean) => {
        if (next) {
            setValue(toDateTimeLocalValue(date));
        }
        setOpen(next);
    };

    const handleSave = () => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            alert('Neispravan datum.');
            return;
        }

        startTransition(async () => {
            try {
                const result = await onSave(parsed.toISOString());
                if (result && result.success === false) {
                    alert('Došlo je do greške pri ažuriranju datuma.');
                    return;
                }
                setOpen(false);
            } catch (error) {
                console.error('Error updating event date:', error);
                alert('Došlo je do greške pri ažuriranju datuma.');
            }
        });
    };

    return (
        <Popper
            open={open}
            onOpenChange={handleOpenChange}
            className="w-72 p-3"
            align="start"
            trigger={
                <Button
                    type="button"
                    variant="plain"
                    size="sm"
                    className="px-1 -mx-1"
                >
                    <LocalDateTime>{date}</LocalDateTime>
                </Button>
            }
        >
            <Stack spacing={3}>
                <Typography level="h5">Promijeni datum</Typography>
                <Input
                    type="datetime-local"
                    label="Datum i vrijeme"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    disabled={isPending}
                    fullWidth
                />
                <Row spacing={2} className="justify-end">
                    <Button
                        type="button"
                        variant="plain"
                        onClick={() => setOpen(false)}
                        disabled={isPending}
                    >
                        Odustani
                    </Button>
                    <Button
                        type="button"
                        variant="solid"
                        onClick={handleSave}
                        disabled={isPending}
                        loading={isPending}
                    >
                        Spremi
                    </Button>
                </Row>
            </Stack>
        </Popper>
    );
}
