import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Close, Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Tooltip, TooltipContent, TooltipTrigger } from '@gredice/ui/Tooltip';
import { Typography } from '@gredice/ui/Typography';
import { type ReactNode, useState } from 'react';
import {
    type DiaryCancelTarget,
    useCancelDiaryEntry,
} from '../../hooks/useCancelDiaryEntry';
import {
    type SelectedPlantingDiaryTarget,
    useSelectedPlantingOwnerAction,
} from '../../hooks/useSelectedPlantingOwnerAction';
import { GameModal } from '../../shared-ui/game-modal';

export function RaisedBedDiaryCancelAction({
    disabledReason,
    entryName,
    gardenId,
    target,
    triggerLabel = 'Otkaži',
}: {
    disabledReason?: string | null;
    entryName: string;
    gardenId: number;
    target: DiaryCancelTarget | SelectedPlantingDiaryTarget;
    triggerLabel?: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const mutation = useCancelDiaryEntry(gardenId);
    const selectedMutation = useSelectedPlantingOwnerAction(
        gardenId,
        target.raisedBedId ?? 0,
    );
    const isPending =
        target.type === 'selectedPlanting'
            ? selectedMutation.isPending
            : mutation.isPending;
    const [reason, setReason] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const triggerTitle =
        typeof triggerLabel === 'string' ? triggerLabel : 'Otkaži';
    const triggerButton = (
        <IconButton
            type="button"
            size="xs"
            variant="plain"
            color="danger"
            disabled={Boolean(disabledReason)}
            title={triggerTitle}
            className="h-7 w-7 shrink-0 bg-transparent hover:bg-transparent dark:hover:bg-transparent"
        >
            <Close className="size-4 shrink-0" />
        </IconButton>
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

    async function handleCancel() {
        setErrorMessage(null);

        try {
            if (target.type === 'selectedPlanting') {
                if (!reason.trim()) return;
                const result = await selectedMutation.mutateAsync({
                    type: 'cancel',
                    reason: reason.trim(),
                    target,
                });
                setSuccessMessage(
                    result.type === 'cancel' && result.refundAmount > 0
                        ? `Sijanje je otkazano. Vraćeno je ${result.refundAmount} 🌻.`
                        : 'Sijanje je otkazano. Za ovu sadnju nema povrata.',
                );
            } else {
                await mutation.mutateAsync(target);
                setOpen(false);
            }
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Otkazivanje nije uspjelo.',
            );
        }
    }

    return (
        <GameModal
            title={`Otkaži ${entryName}`}
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    setErrorMessage(null);
                    setReason('');
                    setSuccessMessage(null);
                }
            }}
            trigger={triggerButton}
        >
            <Stack spacing={4}>
                <Stack spacing={1}>
                    <Typography level="h5">Otkaži radnju</Typography>
                    <Typography level="body2" secondary>
                        Otkazat ćeš {entryName}.{' '}
                        {target.type === 'selectedPlanting'
                            ? 'Otkazivanje vrijedi za cijelu sadnju. Mogući povrat prikazat će se nakon potvrde.'
                            : 'Suncokreti će se vratiti na račun, a obavijest će ostati u porukama.'}
                    </Typography>
                </Stack>

                <Alert
                    color="warning"
                    startDecorator={<Warning className="size-4 shrink-0" />}
                >
                    Otkazivanje se ne može poništiti.
                </Alert>

                {errorMessage ? (
                    <Alert color="danger">
                        <Typography level="body2">{errorMessage}</Typography>
                    </Alert>
                ) : null}

                {target.type === 'selectedPlanting' && !successMessage && (
                    <Input
                        label="Razlog otkazivanja"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={2000}
                        disabled={isPending}
                        fullWidth
                    />
                )}
                {successMessage && (
                    <Alert color="success">{successMessage}</Alert>
                )}
                <Row spacing={2} className="justify-end">
                    <Button
                        type="button"
                        variant="plain"
                        disabled={isPending}
                        onClick={() => setOpen(false)}
                    >
                        {successMessage ? 'Zatvori' : 'Odustani'}
                    </Button>
                    {!successMessage && (
                        <Button
                            type="button"
                            variant="solid"
                            color="danger"
                            loading={isPending}
                            disabled={
                                isPending ||
                                (target.type === 'selectedPlanting' &&
                                    !reason.trim())
                            }
                            startDecorator={
                                <Close className="size-4 shrink-0" />
                            }
                            onClick={handleCancel}
                        >
                            Otkaži
                        </Button>
                    )}
                </Row>
            </Stack>
        </GameModal>
    );
}
