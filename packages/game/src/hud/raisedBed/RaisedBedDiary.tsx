import { ImageGallery } from '@gredice/ui/ImageGallery';
import { Alert } from '@signalco/ui/Alert';
import { Chip } from '@signalco/ui-primitives/Chip';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type ReactNode, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useGameFlags } from '../../GameFlagsContext';
import { useRaisedBedDiaryEntries } from '../../hooks/useRaisedBedDiaryEntries';
import { useRaisedBedFieldDiaryEntries } from '../../hooks/useRaisedBedFieldDiaryEntries';
import { RaisedBedDiaryAiAction } from './RaisedBedDiaryAiAction';

type DiaryEntry = {
    id: number;
    name: string;
    description: string | undefined;
    status: string | null;
    timestamp: Date;
    imageUrls?: string[] | null;
    isMarkdown?: boolean;
};

type DiaryEntryAiHistory = {
    count: number;
    latestTimestamp: Date;
    entries: DiaryEntry[];
};

function relateAiHistory(entries: DiaryEntry[] | undefined) {
    const aiHistoryByEntryId = new Map<number, DiaryEntryAiHistory>();

    if (!entries?.length) {
        return aiHistoryByEntryId;
    }

    const aiEntries = entries.filter(
        (entry) => entry.isMarkdown && entry.imageUrls?.length,
    );

    if (!aiEntries.length) {
        return aiHistoryByEntryId;
    }

    entries.forEach((entry) => {
        if (entry.isMarkdown || !entry.imageUrls?.length) {
            return;
        }

        const relatedAiEntries = aiEntries.filter(
            (aiEntry) =>
                aiEntry.timestamp.getTime() >= entry.timestamp.getTime() &&
                aiEntry.imageUrls?.some((imageUrl) =>
                    entry.imageUrls?.includes(imageUrl),
                ),
        );

        if (!relatedAiEntries.length) {
            return;
        }

        const latestTimestamp = relatedAiEntries.reduce(
            (latest, aiEntry) =>
                aiEntry.timestamp.getTime() > latest.getTime()
                    ? aiEntry.timestamp
                    : latest,
            relatedAiEntries[0].timestamp,
        );

        aiHistoryByEntryId.set(entry.id, {
            count: relatedAiEntries.length,
            latestTimestamp,
            entries: relatedAiEntries.sort(
                (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
            ),
        });
    });

    return aiHistoryByEntryId;
}

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
        <ImageGallery
            images={imageUrls.map((url) => ({ src: url, alt: name }))}
            previewWidth={80}
            previewHeight={80}
            previewAs="div"
            previewVariant="carousel"
        />
    );
}

function DiaryList({
    error,
    isLoading,
    entries,
    renderEntryAction,
}: {
    error: Error | null;
    isLoading: boolean;
    entries: DiaryEntry[] | undefined;
    renderEntryAction?: (
        entry: DiaryEntry,
        aiHistory?: DiaryEntryAiHistory,
    ) => ReactNode;
}) {
    const aiHistoryByEntryId = relateAiHistory(entries);
    const [expandedAiEntry, setExpandedAiEntry] = useState<DiaryEntry | null>(
        null,
    );

    return (
        <>
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
                {entries?.map((entry) => {
                    const aiHistory = aiHistoryByEntryId.get(entry.id);
                    const entryAction = renderEntryAction?.(entry, aiHistory);

                    return (
                        <div
                            key={entry.id}
                            className={entryAction ? 'space-y-1' : undefined}
                        >
                            {entry.isMarkdown ? (
                                <ListItem
                                    nodeId={entry.id.toString()}
                                    onSelected={() => setExpandedAiEntry(entry)}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    label={
                                        <Row
                                            spacing={2}
                                            className="justify-between font-normal"
                                        >
                                            <Row
                                                spacing={2}
                                                className="items-start flex-1"
                                            >
                                                <DiaryEntryImages
                                                    name={entry.name}
                                                    imageUrls={entry.imageUrls}
                                                />
                                                <Stack>
                                                    <Typography
                                                        level="body1"
                                                        semiBold
                                                    >
                                                        {entry.name}
                                                    </Typography>
                                                    <Typography level="body2">
                                                        Klikni za prikaz analize
                                                    </Typography>
                                                </Stack>
                                            </Row>
                                            <Typography
                                                level="body2"
                                                noWrap
                                                className="shrink-0"
                                            >
                                                {entry.timestamp.toLocaleDateString(
                                                    'hr-HR',
                                                )}
                                            </Typography>
                                        </Row>
                                    }
                                />
                            ) : (
                                <ListItem
                                    label={
                                        <Row
                                            spacing={2}
                                            className="justify-between font-normal"
                                        >
                                            <Row
                                                spacing={2}
                                                className="items-start flex-1"
                                            >
                                                <DiaryEntryImages
                                                    name={entry.name}
                                                    imageUrls={entry.imageUrls}
                                                />
                                                <Stack>
                                                    <Typography
                                                        level="body1"
                                                        semiBold
                                                    >
                                                        {entry.name}
                                                    </Typography>
                                                    <Typography level="body2">
                                                        {entry.description}
                                                    </Typography>
                                                </Stack>
                                            </Row>
                                            <Stack className="items-end shrink-0">
                                                {entry.status && (
                                                    <Chip
                                                        color={
                                                            entry.status ===
                                                            'Novo'
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
                                                <Typography
                                                    level="body2"
                                                    noWrap
                                                >
                                                    {entry.timestamp.toLocaleDateString(
                                                        'hr-HR',
                                                    )}
                                                </Typography>
                                            </Stack>
                                        </Row>
                                    }
                                />
                            )}
                            {entryAction && (
                                <div className="flex justify-end px-2 pb-2">
                                    {entryAction}
                                </div>
                            )}
                        </div>
                    );
                })}
            </List>
            <Modal
                open={expandedAiEntry !== null}
                onOpenChange={(open) => {
                    if (!open) setExpandedAiEntry(null);
                }}
                title={expandedAiEntry?.name ?? 'AI analiza'}
                className="md:max-w-3xl"
            >
                {expandedAiEntry && (
                    <Stack spacing={2}>
                        <DiaryEntryImages
                            name={expandedAiEntry.name}
                            imageUrls={expandedAiEntry.imageUrls}
                        />
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>
                                {expandedAiEntry.description ?? ''}
                            </ReactMarkdown>
                        </div>
                        <Typography
                            level="body3"
                            className="text-muted-foreground text-right"
                        >
                            {expandedAiEntry.timestamp.toLocaleDateString(
                                'hr-HR',
                            )}
                        </Typography>
                    </Stack>
                )}
            </Modal>
        </>
    );
}

export function RaisedBedFieldDiary({
    gardenId,
    raisedBedId,
    positionIndex,
    disableActions = false,
}: {
    gardenId: number;
    raisedBedId: number;
    positionIndex: number;
    disableActions?: boolean;
}) {
    const {
        data: entries,
        isLoading,
        error,
    } = useRaisedBedFieldDiaryEntries(gardenId, raisedBedId, positionIndex);
    const flags = useGameFlags();
    const renderEntryAction =
        flags.raisedBedImageAI && !disableActions
            ? (entry: DiaryEntry, aiHistory?: DiaryEntryAiHistory) => {
                  if (!entry.imageUrls?.length || entry.isMarkdown) {
                      return null;
                  }

                  return (
                      <RaisedBedDiaryAiAction
                          gardenId={gardenId}
                          raisedBedId={raisedBedId}
                          positionIndex={positionIndex}
                          entryName={entry.name}
                          imageUrls={entry.imageUrls}
                          historyEntries={aiHistory?.entries}
                      />
                  );
              }
            : undefined;

    return (
        <DiaryList
            error={error}
            isLoading={isLoading}
            entries={entries}
            renderEntryAction={renderEntryAction}
        />
    );
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
    const flags = useGameFlags();
    const renderEntryAction = flags.raisedBedImageAI
        ? (entry: DiaryEntry, aiHistory?: DiaryEntryAiHistory) => {
              if (!entry.imageUrls?.length || entry.isMarkdown) {
                  return null;
              }

              return (
                  <RaisedBedDiaryAiAction
                      gardenId={gardenId}
                      raisedBedId={raisedBedId}
                      entryName={entry.name}
                      imageUrls={entry.imageUrls}
                      historyEntries={aiHistory?.entries}
                  />
              );
          }
        : undefined;

    return (
        <DiaryList
            error={error}
            isLoading={isLoading}
            entries={entries}
            renderEntryAction={renderEntryAction}
        />
    );
}
