import { Alert } from '@signalco/ui/Alert';
import { Chip } from '@signalco/ui-primitives/Chip';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useRaisedBedDiaryEntries } from '../../hooks/useRaisedBedDiaryEntries';
import { useRaisedBedFieldDiaryEntries } from '../../hooks/useRaisedBedFieldDiaryEntries';

function DiaryList({
    error,
    isLoading,
    entries,
}: {
    error: Error | null;
    isLoading: boolean;
    entries:
        | Array<{
              id: number;
              name: string;
              description: string | undefined;
              status: string | null;
              timestamp: Date;
          }>
        | undefined;
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
                        <Row
                            spacing={2}
                            justifyContent="space-between"
                            className="font-normal"
                        >
                            <Stack>
                                <Typography level="body1" semiBold>
                                    {entry.name}
                                </Typography>
                                <Typography level="body2">
                                    {entry.description}
                                </Typography>
                            </Stack>
                            <Stack>
                                {entry.status && (
                                    <Chip
                                        color={
                                            entry.status === 'Novo'
                                                ? 'warning'
                                                : entry.status === 'Završeno'
                                                  ? 'success'
                                                  : entry.status === 'Planirano'
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
    return <DiaryList error={error} isLoading={isLoading} entries={entries} />;
}
