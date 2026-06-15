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
import Image from 'next/image';
import type { ReactNode } from 'react';
import { useGameFlags } from '../../GameFlagsContext';
import { isDiaryCancelTargetEligible } from '../../hooks/useCancelDiaryEntry';
import { useRaisedBedDiaryEntries } from '../../hooks/useRaisedBedDiaryEntries';
import { useRaisedBedFieldDiaryEntries } from '../../hooks/useRaisedBedFieldDiaryEntries';
import {
    type DiaryRescheduleTarget,
    isDiaryRescheduleTargetEligible,
} from '../../hooks/useRescheduleDiaryEntry';
import { RaisedBedAiOperationMarkdown } from './RaisedBedAiOperationMarkdown';
import { RaisedBedDiaryAiAction } from './RaisedBedDiaryAiAction';
import { RaisedBedDiaryCancelAction } from './RaisedBedDiaryCancelAction';
import { RaisedBedDiaryRescheduleAction } from './RaisedBedDiaryRescheduleAction';

type DiaryEntry = {
    id: number;
    name: string;
    description: string | undefined;
    status: string | null;
    timestamp: Date;
    imageUrls?: string[] | null;
    isMarkdown?: boolean;
    rescheduleTarget?: DiaryRescheduleTarget;
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
        <div
            className={cx('min-w-0 max-w-full overflow-hidden', className)}
            data-diary-entry-images
        >
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

function diaryEntryImagesClassName(imageUrls?: string[] | null) {
    return cx('w-20 shrink-0', (imageUrls?.length ?? 0) > 1 && 'sm:w-44');
}

function diaryEntryActions({
    aiAction,
    entry,
    gardenId,
}: {
    aiAction?: ReactNode;
    entry: DiaryEntry;
    gardenId: number;
}) {
    const rescheduleTarget = entry.rescheduleTarget;
    const rescheduleAction = isDiaryRescheduleTargetEligible(
        rescheduleTarget,
    ) ? (
        <RaisedBedDiaryRescheduleAction
            entryName={entry.name}
            gardenId={gardenId}
            target={rescheduleTarget}
        />
    ) : null;
    const cancelAction = isDiaryCancelTargetEligible(rescheduleTarget) ? (
        <RaisedBedDiaryCancelAction
            entryName={entry.name}
            gardenId={gardenId}
            target={rescheduleTarget}
        />
    ) : null;

    if (!aiAction && !rescheduleAction && !cancelAction) {
        return null;
    }

    return (
        <Row spacing={2} className="flex-wrap items-center">
            {rescheduleAction}
            {cancelAction}
            {aiAction}
        </Row>
    );
}

function SavedAiDiaryEntryButton({
    entry,
    gardenId,
}: {
    entry: DiaryEntry;
    gardenId: number;
}) {
    return (
        <Modal
            title={entry.name}
            className="md:max-w-3xl"
            trigger={
                <button
                    type="button"
                    className="relative inline-flex h-auto w-fit min-w-0 items-center justify-start gap-2 rounded-md p-0 text-left text-xs font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    Klikni za prikaz savjeta suncokreta
                </button>
            }
        >
            <Stack spacing={4}>
                <DiaryEntryImages
                    name={entry.name}
                    imageUrls={entry.imageUrls}
                />
                <div className="prose prose-sm max-w-none dark:prose-invert">
                    <RaisedBedAiOperationMarkdown gardenId={gardenId}>
                        {entry.description ?? ''}
                    </RaisedBedAiOperationMarkdown>
                </div>
                <Typography
                    level="body3"
                    className="text-muted-foreground text-right"
                >
                    {entry.timestamp.toLocaleDateString('hr-HR')}
                </Typography>
            </Stack>
        </Modal>
    );
}

function DiaryList({
    error,
    gardenId,
    isLoading,
    entries,
    renderEntryAction,
}: {
    error: Error | null;
    gardenId: number;
    isLoading: boolean;
    entries: DiaryEntry[] | undefined;
    renderEntryAction?: (
        entry: DiaryEntry,
        aiHistory?: DiaryEntryAiHistory,
    ) => ReactNode;
}) {
    const aiHistoryByEntryId = relateAiHistory(entries);

    return (
        <List className="w-full max-w-full overflow-x-hidden" data-diary-list>
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
                        className="w-full min-w-0 max-w-full"
                        data-diary-entry
                    >
                        {entry.isMarkdown ? (
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
                                                className={diaryEntryImagesClassName(
                                                    entry.imageUrls,
                                                )}
                                            />
                                            <Stack
                                                className="min-w-0 flex-1"
                                                data-diary-entry-content
                                            >
                                                <Typography
                                                    level="body1"
                                                    semiBold
                                                    className="flex min-w-0 items-center gap-1.5 break-words"
                                                >
                                                    <Image
                                                        src="https://cdn.gredice.com/sunflower-large.svg"
                                                        alt=""
                                                        width={18}
                                                        height={18}
                                                        className="size-[18px] shrink-0"
                                                    />
                                                    <span className="min-w-0 break-words">
                                                        {entry.name}
                                                    </span>
                                                </Typography>
                                                <SavedAiDiaryEntryButton
                                                    entry={entry}
                                                    gardenId={gardenId}
                                                />
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
                                                className={diaryEntryImagesClassName(
                                                    entry.imageUrls,
                                                )}
                                            />
                                            <Stack
                                                className="min-w-0 flex-1"
                                                data-diary-entry-content
                                            >
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
                                                {entryAction && (
                                                    <div className="mt-2 w-fit max-w-full">
                                                        {entryAction}
                                                    </div>
                                                )}
                                            </Stack>
                                        </Row>
                                        <Stack className="w-full min-w-0 items-start sm:w-auto sm:shrink-0 sm:items-end">
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
                                                    className="shrink-0 w-fit max-w-full self-start sm:self-end"
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
                        )}
                    </div>
                );
            })}
        </List>
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
                  const aiAction =
                      entry.imageUrls?.length && !entry.isMarkdown ? (
                          <RaisedBedDiaryAiAction
                              gardenId={gardenId}
                              raisedBedId={raisedBedId}
                              positionIndex={positionIndex}
                              entryName={entry.name}
                              imageUrls={entry.imageUrls}
                              referenceDate={entry.timestamp}
                              historyEntries={aiHistory?.entries}
                          />
                      ) : undefined;

                  return diaryEntryActions({
                      aiAction,
                      entry,
                      gardenId,
                  });
              }
            : !disableActions
              ? (entry: DiaryEntry) =>
                    diaryEntryActions({
                        entry,
                        gardenId,
                    })
              : undefined;

    return (
        <DiaryList
            error={error}
            gardenId={gardenId}
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
              const aiAction =
                  entry.imageUrls?.length && !entry.isMarkdown ? (
                      <RaisedBedDiaryAiAction
                          gardenId={gardenId}
                          raisedBedId={raisedBedId}
                          entryName={entry.name}
                          imageUrls={entry.imageUrls}
                          referenceDate={entry.timestamp}
                          historyEntries={aiHistory?.entries}
                      />
                  ) : undefined;

              return diaryEntryActions({
                  aiAction,
                  entry,
                  gardenId,
              });
          }
        : (entry: DiaryEntry) =>
              diaryEntryActions({
                  entry,
                  gardenId,
              });

    return (
        <DiaryList
            error={error}
            gardenId={gardenId}
            isLoading={isLoading}
            entries={entries}
            renderEntryAction={renderEntryAction}
        />
    );
}
