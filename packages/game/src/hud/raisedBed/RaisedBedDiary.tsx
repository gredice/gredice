import { Alert } from '@gredice/ui/Alert';
import { Chip } from '@gredice/ui/Chip';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
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
    className,
}: {
    name: string;
    imageUrls?: string[] | null;
    className?: string;
}) {
    if (!imageUrls?.length) {
        return null;
    }

    return (
        <div className={cx('min-w-0 max-w-full overflow-hidden', className)}>
            <ImageGallery
                images={imageUrls.map((url) => ({ src: url, alt: name }))}
                previewWidth={80}
                previewHeight={80}
                previewAs="div"
                previewVariant="carousel"
            />
        </div>
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
            <List
                className="w-full max-w-full overflow-x-hidden"
                data-diary-list
            >
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
                            className={cx(
                                'w-full min-w-0 max-w-full',
                                entryAction && 'space-y-1',
                            )}
                            data-diary-entry
                        >
                            {entry.isMarkdown ? (
                                <ListItem
                                    nodeId={entry.id.toString()}
                                    onSelected={() => setExpandedAiEntry(entry)}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors max-w-full"
                                    label={
                                        <Row
                                            spacing={4}
                                            className="w-full min-w-0 flex-col items-stretch justify-between font-normal sm:flex-row sm:items-start"
                                        >
                                            <Row
                                                spacing={4}
                                                className="min-w-0 flex-1 items-start"
                                            >
                                                <DiaryEntryImages
                                                    name={entry.name}
                                                    imageUrls={entry.imageUrls}
                                                    className="w-20 shrink-0 sm:w-44"
                                                />
                                                <Stack className="min-w-0 flex-1">
                                                    <Typography
                                                        level="body1"
                                                        semiBold
                                                        className="break-words"
                                                    >
                                                        {entry.name}
                                                    </Typography>
                                                    <Typography
                                                        level="body2"
                                                        className="break-words"
                                                    >
                                                        Klikni za prikaz analize
                                                    </Typography>
                                                </Stack>
                                            </Row>
                                            <Typography
                                                level="body2"
                                                noWrap
                                                className="shrink-0 self-start sm:self-auto"
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
                                    className="max-w-full"
                                    label={
                                        <Row
                                            spacing={4}
                                            className="w-full min-w-0 flex-col items-stretch justify-between font-normal sm:flex-row sm:items-start"
                                        >
                                            <Row
                                                spacing={4}
                                                className="min-w-0 flex-1 items-start"
                                            >
                                                <DiaryEntryImages
                                                    name={entry.name}
                                                    imageUrls={entry.imageUrls}
                                                    className="w-20 shrink-0 sm:w-44"
                                                />
                                                <Stack className="min-w-0 flex-1">
                                                    <Typography
                                                        level="body1"
                                                        semiBold
                                                        className="break-words"
                                                    >
                                                        {entry.name}
                                                    </Typography>
                                                    <Typography
                                                        level="body2"
                                                        className="break-words"
                                                    >
                                                        {entry.description}
                                                    </Typography>
                                                </Stack>
                                            </Row>
                                            <Stack className="w-full min-w-0 items-start sm:w-auto sm:shrink-0 sm:items-end">
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
                                                        className="shrink-0 w-fit max-w-full self-start sm:self-end"
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
                    <Stack spacing={4}>
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
