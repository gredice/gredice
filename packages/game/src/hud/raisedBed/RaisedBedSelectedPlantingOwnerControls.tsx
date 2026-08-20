'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { CalendarDatePicker } from '@gredice/ui/CalendarDatePicker';
import { Input } from '@gredice/ui/Input';
import { Calendar, Close } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { Typography } from '@gredice/ui/Typography';
import { type FormEvent, useId, useState } from 'react';
import {
    formatDiaryRescheduleDateInput,
    getMinimumDiaryRescheduleDateInput,
} from '../../hooks/useRescheduleDiaryEntry';
import { useSelectedPlantingOwnerAction } from '../../hooks/useSelectedPlantingOwnerAction';
import type { AdvancedSowingGardenPlantingVisual } from './advancedSowingGardenVisuals';
import {
    getSelectedPlantingOwnerActionModel,
    selectedPlantingOwnerTaskStatusLabel,
} from './selectedPlantingOwnerActions';

function initialScheduledDate(
    scheduledDateValue: string | null | undefined,
    minimumDate: string,
) {
    if (!scheduledDateValue) {
        return minimumDate;
    }
    const scheduledDate = new Date(scheduledDateValue);
    if (Number.isNaN(scheduledDate.getTime())) {
        return minimumDate;
    }
    const formatted = formatDiaryRescheduleDateInput(scheduledDate);
    return formatted >= minimumDate ? formatted : minimumDate;
}

function scheduleDateLabel(scheduledDateValue: string | null) {
    if (!scheduledDateValue) {
        return 'Termin još nije određen';
    }
    const scheduledDate = new Date(scheduledDateValue);
    if (Number.isNaN(scheduledDate.getTime())) {
        return 'Termin nije dostupan';
    }
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        timeZone: 'UTC',
    }).format(scheduledDate);
}

export function RaisedBedSelectedPlantingOwnerControls({
    gardenId,
    planting,
    raisedBedId,
}: {
    gardenId: number;
    planting: AdvancedSowingGardenPlantingVisual;
    raisedBedId: number;
}) {
    const minimumDate = getMinimumDiaryRescheduleDateInput();
    const [scheduledDate, setScheduledDate] = useState(() =>
        initialScheduledDate(planting.selectedTask?.scheduledDate, minimumDate),
    );
    const [sowInGreenhouse, setSowInGreenhouse] = useState(
        planting.selectedTask?.sowingLocation === 'greenhouse',
    );
    const [cancellationReason, setCancellationReason] = useState('');
    const [cancelToConfirm, setCancelToConfirm] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const greenhouseSwitchId = useId();
    const mutation = useSelectedPlantingOwnerAction(gardenId, raisedBedId);
    const actionModel = getSelectedPlantingOwnerActionModel(planting);
    const task = planting.selectedTask;
    const expectedLifecycleVersionEventId =
        planting.expectedLifecycleVersionEventId;

    if (
        !task ||
        expectedLifecycleVersionEventId === null ||
        !actionModel.canReschedule
    ) {
        return null;
    }

    const target = {
        expectedLifecycleVersionEventId,
        expectedPlantSortId: planting.plantSortId,
        plantingId: planting.id,
    };

    async function handleReschedule(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);
        if (!scheduledDate) {
            setErrorMessage('Odaberi novi datum sijanja.');
            return;
        }
        try {
            await mutation.mutateAsync({
                scheduledDate,
                sowingLocation: sowInGreenhouse ? 'greenhouse' : 'direct',
                target,
                type: 'reschedule',
            });
            setSuccessMessage('Novi termin sijanja je spremljen.');
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Promjena termina nije uspjela.',
            );
        }
    }

    async function handleCancel() {
        setErrorMessage(null);
        setSuccessMessage(null);
        const reason = cancellationReason.trim();
        if (!reason) {
            setErrorMessage('Upiši razlog otkazivanja.');
            return;
        }
        try {
            const result = await mutation.mutateAsync({
                reason,
                target,
                type: 'cancel',
            });
            setSuccessMessage(
                result.type === 'cancel' && result.refundAmount > 0
                    ? `Sijanje je otkazano. Vraćeno je ${result.refundAmount.toString()} 🌻.`
                    : 'Sijanje je otkazano. Za ovu sadnju nema povrata.',
            );
            setCancelToConfirm(false);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Otkazivanje sijanja nije uspjelo.',
            );
        }
    }

    return (
        <Stack
            className="rounded-md border bg-card p-3"
            data-selected-planting-owner-controls="true"
            spacing={3}
        >
            <Stack spacing={1}>
                <Typography component="h4" level="body2" semiBold>
                    Zadatak sijanja
                </Typography>
                <Typography level="body3" secondary>
                    {selectedPlantingOwnerTaskStatusLabel(task)} ·{' '}
                    {scheduleDateLabel(task.scheduledDate)} ·{' '}
                    {task.sowingLocation === 'greenhouse'
                        ? 'Staklenik'
                        : 'Izravno u gredicu'}
                </Typography>
            </Stack>

            {errorMessage ? (
                <Alert color="danger">
                    <Typography level="body2">{errorMessage}</Typography>
                </Alert>
            ) : null}
            {successMessage ? (
                <Alert color="success">
                    <Typography level="body2">{successMessage}</Typography>
                </Alert>
            ) : null}

            <form
                className="space-y-3 border-t pt-3"
                data-selected-planting-reschedule="true"
                onSubmit={handleReschedule}
            >
                <Typography level="body2" semiBold>
                    Promijeni termin prije sijanja
                </Typography>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <CalendarDatePicker
                        disabled={mutation.isPending}
                        fullWidth
                        label="Novi datum sijanja"
                        min={minimumDate}
                        name="selectedPlantingScheduledDate"
                        onValueChange={setScheduledDate}
                        required
                        value={scheduledDate}
                    />
                    <div className="space-y-1">
                        <label
                            className="block text-sm font-medium text-foreground"
                            htmlFor={greenhouseSwitchId}
                        >
                            Mjesto sijanja
                        </label>
                        <div className="flex h-10 items-center gap-2 rounded-md border px-3">
                            <Switch
                                aria-label="Sijanje u stakleniku"
                                checked={sowInGreenhouse}
                                disabled={mutation.isPending}
                                id={greenhouseSwitchId}
                                onCheckedChange={setSowInGreenhouse}
                                size="sm"
                            />
                            <span className="text-sm">
                                {sowInGreenhouse ? 'Staklenik' : 'Izravno'}
                            </span>
                        </div>
                    </div>
                </div>
                <Button
                    disabled={mutation.isPending}
                    loading={mutation.isPending}
                    size="sm"
                    startDecorator={<Calendar className="size-4" />}
                    type="submit"
                    variant="soft"
                >
                    Spremi raspored
                </Button>
            </form>

            <div
                className="space-y-3 border-t pt-3"
                data-selected-planting-cancel="true"
            >
                <Typography level="body2" semiBold>
                    Otkaži prije sijanja
                </Typography>
                <Input
                    disabled={mutation.isPending || !actionModel.canCancel}
                    fullWidth
                    label="Razlog otkazivanja"
                    maxLength={2000}
                    onChange={(event) =>
                        setCancellationReason(event.target.value)
                    }
                    placeholder="Primjerice: promjena plana"
                    value={cancellationReason}
                />
                {actionModel.cancelDisabledReason ? (
                    <Typography level="body3" secondary>
                        {actionModel.cancelDisabledReason}
                    </Typography>
                ) : (
                    <Typography level="body3" secondary>
                        Otkazivanje je trajno. Mogući povrat prikazat će se
                        nakon potvrde.
                    </Typography>
                )}
                <Button
                    color="danger"
                    disabled={
                        mutation.isPending ||
                        !actionModel.canCancel ||
                        !cancellationReason.trim()
                    }
                    loading={mutation.isPending}
                    onClick={() => setCancelToConfirm(true)}
                    size="sm"
                    startDecorator={<Close className="size-4" />}
                    type="button"
                    variant="soft"
                >
                    Otkaži sijanje
                </Button>
            </div>
            <ModalConfirm
                cancelLabel="Odustani"
                confirmLabel={
                    mutation.isPending ? 'Otkazujem...' : 'Otkaži sijanje'
                }
                header="Potvrda otkazivanja sijanja"
                onConfirm={() => {
                    if (!mutation.isPending) {
                        void handleCancel();
                    }
                }}
                onOpenChange={setCancelToConfirm}
                open={cancelToConfirm}
                title="Potvrda otkazivanja sijanja"
            >
                Otkazivanje se ne može poništiti. Želiš li otkazati ovu cijelu
                sadnju?
            </ModalConfirm>
        </Stack>
    );
}
