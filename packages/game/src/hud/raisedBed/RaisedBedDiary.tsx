import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Alert } from '@signalco/ui/Alert';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Input } from '@signalco/ui-primitives/Input';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type ReactElement, useState } from 'react';
import {
    useCancelOperationMutation,
    useRescheduleOperationMutation,
} from '../../hooks/useOperationDiaryMutations';
import {
    type RaisedBedDiaryEntry,
    useRaisedBedDiaryEntries,
} from '../../hooks/useRaisedBedDiaryEntries';
import { useRaisedBedFieldDiaryEntries } from '../../hooks/useRaisedBedFieldDiaryEntries';
import { formatLocalDate } from './RaisedBedPlantPicker';

function DiaryEntryImages({
    name,
    imageUrls,
}: {
    name: string;
    imageUrls?: string[] | null;
}) {
    if (!imageUrls?.length) {
        return null;
    }

    return (
        <Row spacing={1} className="flex-wrap items-start shrink-0">
            {imageUrls.map((url) => (
                <ImageViewer
                    key={url}
                    src={url}
                    alt={name}
                    previewWidth={80}
                    previewHeight={80}
                />
            ))}
        </Row>
    );
}

function RescheduleOperationModal({
    gardenId,
    raisedBedId,
    operationId,
    scheduledDate,
    trigger,
}: {
    gardenId: number;
    raisedBedId: number;
    operationId: number;
    scheduledDate: Date | null | undefined;
    trigger: ReactElement;
}) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const rescheduleOperation = useRescheduleOperationMutation();

    const today = new Date();
    const tomorrow = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
    );
    const threeMonthsFromTomorrow = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth() + 3,
        tomorrow.getDate(),
    );
    const defaultDate = scheduledDate ?? tomorrow;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);
        const newDate = formData.get('scheduledDate') as string | null;
        if (!newDate) {
            setError('Odaberi novi datum za radnju.');
            return;
        }

        try {
            await rescheduleOperation.mutateAsync({
                gardenId,
                raisedBedId,
                operationId,
                scheduledDate: new Date(newDate).toISOString(),
            });
            setOpen(false);
        } catch (mutationError) {
            console.error('Failed to reschedule operation:', mutationError);
            setError(
                mutationError instanceof Error
                    ? mutationError.message
                    : 'Neuspjelo prebacivanje radnje.',
            );
        }
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (!nextOpen) {
            setError(null);
            rescheduleOperation.reset();
        }
    }

    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);
    const defaultValue = formatLocalDate(defaultDate);

    return (
        <Modal
            trigger={trigger}
            open={open}
            onOpenChange={handleOpenChange}
            title="Promijeni termin radnje"
            className="border border-tertiary border-b-4"
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="body1">
                        Odaberi novi datum kada želiš da se radnja izvrši.
                    </Typography>
                    {error && (
                        <Alert color="danger">
                            <Typography level="body2">{error}</Typography>
                        </Alert>
                    )}
                    <Input
                        type="date"
                        name="scheduledDate"
                        label="Novi datum radnje"
                        className="w-full bg-card"
                        defaultValue={defaultValue}
                        min={min}
                        max={max}
                        disabled={rescheduleOperation.isPending}
                        required
                    />
                    <Row spacing={1} justifyContent="end">
                        <Button
                            type="button"
                            variant="plain"
                            onClick={() => setOpen(false)}
                            disabled={rescheduleOperation.isPending}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            variant="solid"
                            loading={rescheduleOperation.isPending}
                        >
                            Spremi
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}

function CancelOperationModal({
    gardenId,
    raisedBedId,
    operationId,
    trigger,
}: {
    gardenId: number;
    raisedBedId: number;
    operationId: number;
    trigger: ReactElement;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const cancelOperation = useCancelOperationMutation();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!reason.trim()) {
            setError('Navedi razlog otkazivanja.');
            return;
        }

        try {
            await cancelOperation.mutateAsync({
                gardenId,
                raisedBedId,
                operationId,
                reason: reason.trim(),
            });
            setOpen(false);
            setReason('');
        } catch (mutationError) {
            console.error('Failed to cancel operation:', mutationError);
            setError(
                mutationError instanceof Error
                    ? mutationError.message
                    : 'Neuspjelo otkazivanje radnje.',
            );
        }
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (!nextOpen) {
            setReason('');
            setError(null);
            cancelOperation.reset();
        }
    }

    return (
        <Modal
            trigger={trigger}
            open={open}
            onOpenChange={handleOpenChange}
            title="Otkaži radnju"
            className="border border-tertiary border-b-4"
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="body1">
                        Otkazivanje radnje je nepovratno. Navedi razlog kako bi
                        ekipa znala što se dogodilo.
                    </Typography>
                    {error && (
                        <Alert color="danger">
                            <Typography level="body2">{error}</Typography>
                        </Alert>
                    )}
                    <Stack spacing={1}>
                        <Typography level="body3" semiBold>
                            Razlog otkazivanja
                        </Typography>
                        <textarea
                            name="reason"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            className="w-full bg-card border border-border rounded-md p-3 min-h-24 resize-vertical text-base text-foreground"
                            placeholder="Objasni zašto želiš otkazati radnju..."
                            required
                        />
                    </Stack>
                    <Row spacing={1} justifyContent="end">
                        <Button
                            type="button"
                            variant="plain"
                            onClick={() => setOpen(false)}
                            disabled={cancelOperation.isPending}
                        >
                            Zatvori
                        </Button>
                        <Button
                            type="submit"
                            variant="solid"
                            color="danger"
                            loading={cancelOperation.isPending}
                            disabled={
                                !reason.trim() || cancelOperation.isPending
                            }
                        >
                            Otkaži radnju
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}

function OperationActions({
    entry,
    gardenId,
    raisedBedId,
}: {
    entry: RaisedBedDiaryEntry;
    gardenId: number;
    raisedBedId: number;
}) {
    if (entry.kind !== 'operation' || entry.statusCode !== 'planned') {
        return null;
    }

    return (
        <Row spacing={1} className="flex-wrap gap-y-1">
            <RescheduleOperationModal
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                operationId={entry.id}
                scheduledDate={entry.scheduledDate ?? null}
                trigger={
                    <Button variant="outlined" size="sm">
                        Promijeni termin
                    </Button>
                }
            />
            <CancelOperationModal
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                operationId={entry.id}
                trigger={
                    <Button variant="outlined" color="danger" size="sm">
                        Otkaži radnju
                    </Button>
                }
            />
        </Row>
    );
}

function DiaryList({
    error,
    isLoading,
    entries,
    renderActions,
}: {
    error: Error | null;
    isLoading: boolean;
    entries: RaisedBedDiaryEntry[] | undefined;
    renderActions?: (entry: RaisedBedDiaryEntry) => React.ReactNode;
}) {
    return (
        <List>
            {error && (
                <Alert color="danger">
                    <Typography level="body2">
                        {
                            'Došlo je do pogreške prilikom učitavanja dnevnika. Pokušaj ponovno.'
                        }
                    </Typography>
                </Alert>
            )}
            {isLoading && (
                <Spinner
                    loading
                    loadingLabel="Učitavanje dnevnika..."
                    className="mx-auto my-8 flex items-center justify-center"
                />
            )}
            {!isLoading && !entries?.length && (
                <ListItem
                    label={
                        <Typography level="body2" className="px-2 py-4">
                            Nema unosa u dnevniku.
                        </Typography>
                    }
                />
            )}
            {entries?.map((entry) => (
                <ListItem
                    key={entry.id}
                    label={
                        <Stack spacing={2}>
                            <Row
                                spacing={2}
                                className="justify-between font-normal"
                            >
                                <Row spacing={2} className="items-start flex-1">
                                    <DiaryEntryImages
                                        name={entry.name}
                                        imageUrls={entry.imageUrls}
                                    />
                                    <Stack spacing={1}>
                                        <Typography level="body1" semiBold>
                                            {entry.name}
                                        </Typography>
                                        {entry.description && (
                                            <Typography level="body2">
                                                {entry.description}
                                            </Typography>
                                        )}
                                    </Stack>
                                </Row>
                                <Stack>
                                    {entry.status && (
                                        <Chip
                                            color={
                                                entry.status === 'Novo'
                                                    ? 'warning'
                                                    : entry.status ===
                                                        'Završeno'
                                                      ? 'success'
                                                      : entry.status ===
                                                          'Planirano'
                                                        ? 'info'
                                                        : entry.status ===
                                                                'Neuspješno' ||
                                                            entry.status ===
                                                                'Otkazano'
                                                          ? 'error'
                                                          : 'neutral'
                                            }
                                            className="shrink-0 w-fit self-end"
                                        >
                                            {entry.status}
                                        </Chip>
                                    )}
                                    <Typography level="body2" noWrap>
                                        {entry.timestamp.toLocaleDateString(
                                            'hr-HR',
                                        )}
                                    </Typography>
                                </Stack>
                            </Row>
                            {renderActions?.(entry)}
                        </Stack>
                    }
                />
            ))}
        </List>
    );
}

export function RaisedBedFieldDiary({
    gardenId,
    raisedBedId,
    positionIndex,
}: {
    gardenId: number;
    raisedBedId: number;
    positionIndex: number;
}) {
    const {
        data: entries,
        isLoading,
        error,
    } = useRaisedBedFieldDiaryEntries(gardenId, raisedBedId, positionIndex);
    return <DiaryList error={error} isLoading={isLoading} entries={entries} />;
}

export function RaisedBedDiary({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    const {
        data: entries,
        isLoading,
        error,
    } = useRaisedBedDiaryEntries(gardenId, raisedBedId);
    return (
        <DiaryList
            error={error}
            isLoading={isLoading}
            entries={entries}
            renderActions={(entry) => (
                <OperationActions
                    entry={entry}
                    gardenId={gardenId}
                    raisedBedId={raisedBedId}
                />
            )}
        />
    );
}
