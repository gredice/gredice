import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
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
    target: DiaryCancelTarget;
    triggerLabel?: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const mutation = useCancelDiaryEntry(gardenId);
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
            await mutation.mutateAsync(target);
            setOpen(false);
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
                }
            }}
            trigger={triggerButton}
        >
            <Stack spacing={4}>
                <Stack spacing={1}>
                    <Typography level="h5">Otkaži radnju</Typography>
                    <Typography level="body2" secondary>
                        Otkazat ćeš {entryName}. Suncokreti će se vratiti na
                        račun, a obavijest će ostati u porukama.
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
                        type="button"
                        variant="solid"
                        color="danger"
                        loading={mutation.isPending}
                        disabled={mutation.isPending}
                        startDecorator={<Close className="size-4 shrink-0" />}
                        onClick={handleCancel}
                    >
                        Otkaži
                    </Button>
                </Row>
            </Stack>
        </GameModal>
    );
}
