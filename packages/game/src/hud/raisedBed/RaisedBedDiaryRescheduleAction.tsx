import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Calendar } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Tooltip, TooltipContent, TooltipTrigger } from '@gredice/ui/Tooltip';
import { Typography } from '@gredice/ui/Typography';
import { type FormEvent, type ReactNode, useState } from 'react';
import {
    type DiaryRescheduleTarget,
    formatDiaryRescheduleDateInput,
    getMinimumDiaryRescheduleDateInput,
    useRescheduleDiaryEntry,
} from '../../hooks/useRescheduleDiaryEntry';

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
    target: DiaryRescheduleTarget;
    triggerLabel?: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const mutation = useRescheduleDiaryEntry(gardenId);
    const minimumDate = getMinimumDiaryRescheduleDateInput();
    const hasScheduledDate = Boolean(target.scheduledDate);
    const defaultDate = target.scheduledDate
        ? formatDiaryRescheduleDateInput(new Date(target.scheduledDate))
        : minimumDate;
    const currentValue = defaultDate >= minimumDate ? defaultDate : minimumDate;
    const actionLabel =
        triggerLabel ?? (hasScheduledDate ? 'Prerasporedi' : 'Zakaži');
    const modalActionLabel = hasScheduledDate ? 'Prerasporedi' : 'Zakaži';
    const triggerButton = (
        <Button
            type="button"
            size="xs"
            variant="plain"
            disabled={Boolean(disabledReason)}
            startDecorator={<Calendar className="size-3.5 shrink-0" />}
        >
            {actionLabel}
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

        const formData = new FormData(event.currentTarget);
        const scheduledDate = formData.get('scheduledDate');
        if (typeof scheduledDate !== 'string' || !scheduledDate) {
            setErrorMessage('Odaberi novi datum.');
            return;
        }

        try {
            await mutation.mutateAsync({
                scheduledDate,
                target,
            });
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
        <Modal
            title={`${modalActionLabel} ${entryName}`}
            open={open}
            onOpenChange={(nextOpen) => {
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

                    <Input
                        type="date"
                        label="Novi datum"
                        name="scheduledDate"
                        defaultValue={currentValue}
                        min={minimumDate}
                        disabled={mutation.isPending}
                        fullWidth
                        required
                    />

                    <Row spacing={2} className="justify-end">
                        <Button
                            type="button"
                            variant="plain"
                            disabled={mutation.isPending}
                            onClick={() => setOpen(false)}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            variant="solid"
                            loading={mutation.isPending}
                            disabled={mutation.isPending}
                            startDecorator={
                                <Calendar className="size-4 shrink-0" />
                            }
                        >
                            Spremi
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}
