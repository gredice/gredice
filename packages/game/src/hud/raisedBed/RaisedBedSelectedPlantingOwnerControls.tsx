'use client';

import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { CalendarDatePicker } from '@gredice/ui/CalendarDatePicker';
import { Input } from '@gredice/ui/Input';
import { Calendar, Close, Sprout } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Row } from '@gredice/ui/Row';
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
    type SelectedPlantingOwnerLifecycleStatus,
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

function effectiveDateIso(dateValue: string) {
    const [year, month, day] = dateValue.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
    const today = formatDiaryRescheduleDateInput(new Date());
    const lifecycleStartedDate = planting.lifecycleStartedAt
        ? formatDiaryRescheduleDateInput(new Date(planting.lifecycleStartedAt))
        : null;
    const minimumLifecycleDate =
        lifecycleStartedDate && lifecycleStartedDate <= today
            ? lifecycleStartedDate
            : undefined;
    const [lifecycleEffectiveDate, setLifecycleEffectiveDate] = useState(today);
    const [statusToConfirm, setStatusToConfirm] =
        useState<SelectedPlantingOwnerLifecycleStatus | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const greenhouseSwitchId = useId();
    const mutation = useSelectedPlantingOwnerAction(gardenId, raisedBedId);
    const actionModel = getSelectedPlantingOwnerActionModel(planting);
    const task = planting.selectedTask;
    const expectedLifecycleVersionEventId =
        planting.expectedLifecycleVersionEventId;

    if (!task || expectedLifecycleVersionEventId === null) {
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

    async function handleStatusChange(
        status: SelectedPlantingOwnerLifecycleStatus,
    ) {
        setErrorMessage(null);
        setSuccessMessage(null);
        const effectiveAt = effectiveDateIso(lifecycleEffectiveDate);
        if (!effectiveAt) {
            setErrorMessage('Odaberi ispravan datum promjene statusa.');
            return;
        }
        try {
            await mutation.mutateAsync({
                effectiveAt,
                status,
                target,
                type: 'updateStatus',
            });
            setStatusToConfirm(null);
            setSuccessMessage(
                `Status je promijenjen u „${plantFieldStatusLabel(status).shortLabel}”.`,
            );
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Promjena statusa nije uspjela.',
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

            {actionModel.canReschedule ? (
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
            ) : null}

            {actionModel.canReschedule ? (
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
            ) : null}
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

            {actionModel.waitingForVerification ? (
                <Alert color="neutral">
                    Status biljke moći ćeš mijenjati nakon što sijanje bude
                    dovršeno i provjereno.
                </Alert>
            ) : null}

            {actionModel.lifecycleTargets.length > 0 ? (
                <div
                    className="space-y-3 border-t pt-3"
                    data-selected-planting-lifecycle-actions="true"
                >
                    <Stack spacing={1}>
                        <Typography level="body2" semiBold>
                            Napredovanje biljke
                        </Typography>
                        <Typography level="body3" secondary>
                            Odaberi samo stanje koje si provjerio u gredici.
                        </Typography>
                    </Stack>
                    <CalendarDatePicker
                        disabled={mutation.isPending}
                        fullWidth
                        label="Datum promjene statusa"
                        max={today}
                        min={minimumLifecycleDate}
                        name="selectedPlantingLifecycleEffectiveDate"
                        onValueChange={setLifecycleEffectiveDate}
                        required
                        value={lifecycleEffectiveDate}
                    />
                    <Row className="flex-wrap" spacing={2}>
                        {actionModel.lifecycleTargets.map((status) => (
                            <Button
                                color={
                                    status === 'removed' ? 'danger' : 'primary'
                                }
                                disabled={mutation.isPending}
                                key={status}
                                loading={mutation.isPending}
                                onClick={() => setStatusToConfirm(status)}
                                size="sm"
                                startDecorator={<Sprout className="size-4" />}
                                type="button"
                                variant="soft"
                            >
                                Označi kao{' '}
                                {plantFieldStatusLabel(
                                    status,
                                ).shortLabel.toLocaleLowerCase('hr-HR')}
                            </Button>
                        ))}
                    </Row>
                </div>
            ) : null}
            <ModalConfirm
                cancelLabel="Odustani"
                confirmLabel={
                    mutation.isPending ? 'Spremam...' : 'Promijeni stanje'
                }
                header="Potvrda promjene stanja"
                onConfirm={() => {
                    if (statusToConfirm && !mutation.isPending) {
                        void handleStatusChange(statusToConfirm);
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setStatusToConfirm(null);
                    }
                }}
                open={statusToConfirm !== null}
                title="Potvrda promjene stanja biljke"
            >
                {statusToConfirm === 'removed'
                    ? 'Jeste li sigurni da želite označiti cijelu sadnju kao uklonjenu? Promjena vrijedi za sva pripadajuća polja.'
                    : statusToConfirm
                      ? `Jeste li sigurni da želite promijeniti stanje biljke u „${plantFieldStatusLabel(statusToConfirm).shortLabel}”?`
                      : 'Jeste li sigurni da želite promijeniti stanje biljke?'}
            </ModalConfirm>
        </Stack>
    );
}
