import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { CalendarDatePicker } from '@gredice/ui/CalendarDatePicker';
import { Calendar } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@gredice/ui/Tooltip';
import { Typography } from '@gredice/ui/Typography';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import {
    type DiaryRescheduleTarget,
    formatDiaryRescheduleDateInput,
    getMinimumDiaryRescheduleDateInput,
    useRescheduleDiaryEntry,
} from '../../hooks/useRescheduleDiaryEntry';
import {
    type SelectedPlantingDiaryTarget,
    useSelectedPlantingOwnerAction,
} from '../../hooks/useSelectedPlantingOwnerAction';
import { GameModal } from '../../shared-ui/game-modal';

export function RaisedBedDiaryRescheduleAction({
    disabledReason,
    entryName,
    gardenId,
    target,
    triggerLabel,
}: {
    disabledReason?: string | null;
    entryName: string;
    gardenId: number;
    target: DiaryRescheduleTarget | SelectedPlantingDiaryTarget;
    triggerLabel?: ReactNode;
}) {
    const greenhouseSwitchId = useId();
    const [open, setOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const mutation = useRescheduleDiaryEntry(gardenId);
    const selectedMutation = useSelectedPlantingOwnerAction(
        gardenId,
        target.raisedBedId ?? 0,
    );
    const isPending =
        target.type === 'selectedPlanting'
            ? selectedMutation.isPending
            : mutation.isPending;
    const [sowInGreenhouse, setSowInGreenhouse] = useState(
        target.type === 'selectedPlanting' &&
            target.sowingLocation === 'greenhouse',
    );
    const minimumDate = getMinimumDiaryRescheduleDateInput();
    const hasScheduledDate = Boolean(target.scheduledDate);
    const defaultDate = target.scheduledDate
        ? formatDiaryRescheduleDateInput(new Date(target.scheduledDate))
        : minimumDate;
    const currentValue = defaultDate >= minimumDate ? defaultDate : minimumDate;
    const [scheduledDate, setScheduledDate] = useState(currentValue);
    const actionLabel =
        triggerLabel ?? (hasScheduledDate ? 'Prerasporedi' : 'Zakaži');
    const modalActionLabel = hasScheduledDate ? 'Prerasporedi' : 'Zakaži';
    const triggerTitle =
        typeof actionLabel === 'string' ? actionLabel : undefined;
    const actionLabelContent =
        typeof actionLabel === 'string' ? (
            <span className="min-w-0 truncate">{actionLabel}</span>
        ) : (
            actionLabel
        );
    const triggerButton = (
        <Button
            type="button"
            size="xs"
            variant="plain"
            disabled={Boolean(disabledReason)}
            title={triggerTitle}
            className="max-w-full shrink"
            startDecorator={<Calendar className="size-3.5 shrink-0" />}
        >
            {actionLabelContent}
        </Button>
    );

    if (disabledReason) {
        return (
            <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                    <span
                        className="inline-flex w-fit max-w-full cursor-not-allowed"
                        title={disabledReason}
                    >
                        {triggerButton}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <Typography level="body3">{disabledReason}</Typography>
                </TooltipContent>
            </Tooltip>
        );
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage(null);

        if (!scheduledDate) {
            setErrorMessage('Odaberi novi datum.');
            return;
        }

        try {
            if (target.type === 'selectedPlanting') {
                await selectedMutation.mutateAsync({
                    type: 'reschedule',
                    scheduledDate,
                    sowingLocation: sowInGreenhouse ? 'greenhouse' : 'direct',
                    target,
                });
            } else {
                await mutation.mutateAsync({ scheduledDate, target });
            }
            setOpen(false);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Preraspoređivanje nije uspjelo.',
            );
        }
    }

    return (
        <GameModal
            title={`${modalActionLabel} ${entryName}`}
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setScheduledDate(currentValue);
                    setSowInGreenhouse(
                        target.type === 'selectedPlanting' &&
                            target.sowingLocation === 'greenhouse',
                    );
                }
                setOpen(nextOpen);
                if (!nextOpen) {
                    setErrorMessage(null);
                }
            }}
            trigger={triggerButton}
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={4}>
                    <Stack spacing={1}>
                        <Typography level="h5">{modalActionLabel}</Typography>
                        <Typography level="body2" secondary>
                            Odaberi {hasScheduledDate ? 'novi ' : ''}datum za{' '}
                            {entryName}.
                        </Typography>
                    </Stack>

                    {errorMessage ? (
                        <Alert color="danger">
                            <Typography level="body2">
                                {errorMessage}
                            </Typography>
                        </Alert>
                    ) : null}

                    <CalendarDatePicker
                        disabled={isPending}
                        fullWidth
                        label="Novi datum"
                        min={minimumDate}
                        name="scheduledDate"
                        onValueChange={setScheduledDate}
                        required
                        value={scheduledDate}
                    />

                    {target.type === 'selectedPlanting' && (
                        <label
                            htmlFor={greenhouseSwitchId}
                            className="flex items-center gap-2 text-sm"
                        >
                            <Switch
                                id={greenhouseSwitchId}
                                aria-label="Sijanje u stakleniku"
                                checked={sowInGreenhouse}
                                disabled={isPending}
                                onCheckedChange={setSowInGreenhouse}
                                size="sm"
                            />
                            Sijanje u stakleniku
                        </label>
                    )}
                    <Row spacing={2} className="justify-end">
                        <Button
                            type="button"
                            variant="plain"
                            disabled={isPending}
                            onClick={() => setOpen(false)}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            variant="solid"
                            loading={isPending}
                            disabled={isPending}
                            startDecorator={
                                <Calendar className="size-4 shrink-0" />
                            }
                        >
                            Spremi
                        </Button>
                    </Row>
                </Stack>
            </form>
        </GameModal>
    );
}
