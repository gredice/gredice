import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Calendar } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type FormEvent, useState } from 'react';
import {
    type DiaryRescheduleTarget,
    formatDiaryRescheduleDateInput,
    getMinimumDiaryRescheduleDateInput,
    useRescheduleDiaryEntry,
} from '../../hooks/useRescheduleDiaryEntry';

export function RaisedBedDiaryRescheduleAction({
    entryName,
    gardenId,
    target,
}: {
    entryName: string;
    gardenId: number;
    target: DiaryRescheduleTarget;
}) {
    const [open, setOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const mutation = useRescheduleDiaryEntry(gardenId);
    const minimumDate = getMinimumDiaryRescheduleDateInput();
    const defaultDate = formatDiaryRescheduleDateInput(
        new Date(target.scheduledDate),
    );
    const currentValue = defaultDate >= minimumDate ? defaultDate : minimumDate;

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
            title={`Prerasporedi ${entryName}`}
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    setErrorMessage(null);
                }
            }}
            trigger={
                <Button
                    type="button"
                    size="xs"
                    variant="soft"
                    startDecorator={<Calendar className="size-3.5 shrink-0" />}
                >
                    Prerasporedi
                </Button>
            }
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={4}>
                    <Stack spacing={1}>
                        <Typography level="h5">Prerasporedi</Typography>
                        <Typography level="body2" secondary>
                            Odaberi novi datum za {entryName}.
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
