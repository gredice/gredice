'use client';

import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Popper } from '@gredice/ui/Popper';
import { SelectItems } from '@gredice/ui/SelectItems';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateSelectedPlantingLifecycleStatusAction } from '../../app/(actions)/selectedRaisedBedPlantingActions';
import { dateInputToTimestamp } from '../../app/admin/greenhouse/sproutedDateInput';
import type { SelectedPlantingStatusControlModel } from './selectedPlantingStatusControls';

function dateInput(value: string | Date) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function SelectedPlantingStatusControl({
    control,
    initialStatus,
    label,
    compact = false,
}: {
    control: SelectedPlantingStatusControlModel;
    initialStatus?: SelectedPlantingStatusControlModel['options'][number]['value'];
    label?: string;
    compact?: boolean;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<string>(
        initialStatus ?? control.status,
    );
    const [date, setDate] = useState(dateInput(control.statusDate));
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const option = control.options.find((item) => item.value === status);
    const maximumDate = dateInput(new Date());

    function save() {
        const timestamp = dateInputToTimestamp(date);
        if (
            !option ||
            !timestamp ||
            date < dateInput(option.minimumDate) ||
            date > maximumDate
        ) {
            setError(
                'Odaberi datum između prethodnog stanja biljke i današnjeg datuma.',
            );
            return;
        }
        setError(null);
        startTransition(async () => {
            try {
                await updateSelectedPlantingLifecycleStatusAction(
                    control.identity,
                    option.value,
                    crypto.randomUUID(),
                    timestamp,
                );
                setOpen(false);
                router.refresh();
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : 'Spremanje stanja biljke nije uspjelo.',
                );
            }
        });
    }

    return (
        <Popper
            open={open}
            onOpenChange={(nextOpen) => {
                if (pending) return;
                if (nextOpen) {
                    setStatus(initialStatus ?? control.status);
                    setDate(
                        dateInput(
                            initialStatus && initialStatus !== control.status
                                ? new Date()
                                : control.statusDate,
                        ),
                    );
                    setError(null);
                }
                setOpen(nextOpen);
            }}
            align="start"
            side="bottom"
            className="w-72 space-y-3 p-3"
            trigger={
                <Button
                    type="button"
                    size="sm"
                    variant="plain"
                    className={
                        compact
                            ? 'h-8 max-w-full border border-input bg-background px-2 text-left shadow-xs'
                            : 'h-auto max-w-full whitespace-normal px-1 text-left'
                    }
                    aria-label={label ?? 'Promijeni stanje biljke'}
                >
                    {label ?? plantFieldStatusLabel(control.status).shortLabel}
                </Button>
            }
        >
            <SelectItems
                label="Stanje biljke"
                items={control.options}
                value={status}
                onValueChange={(nextStatus) => {
                    setStatus(nextStatus);
                    setDate(
                        dateInput(
                            nextStatus === control.status
                                ? control.statusDate
                                : new Date(),
                        ),
                    );
                    setError(null);
                }}
                disabled={pending}
            />
            <Input
                type="date"
                label="Datum stanja"
                aria-label="Datum stanja"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                min={option ? dateInput(option.minimumDate) : undefined}
                max={maximumDate}
                disabled={pending}
            />
            {error && (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                <Button
                    variant="plain"
                    disabled={pending}
                    onClick={() => setOpen(false)}
                >
                    Odustani
                </Button>
                <Button
                    disabled={pending || !option}
                    loading={pending}
                    onClick={save}
                >
                    Spremi
                </Button>
            </div>
        </Popper>
    );
}
