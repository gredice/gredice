import { Alert } from '@gredice/ui/Alert';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { Camera, Navigate } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useEffect, useMemo } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useGardenOperations } from '../../hooks/useGardenOperations';
import { useOperations } from '../../hooks/useOperations';
import { useRaisedBedAiHistory } from '../../hooks/useRaisedBedAiHistory';
import { sortOperationTasksNewestFirst } from '../gardenOperationOrdering';
import { RaisedBedDiaryAiAction } from './RaisedBedDiaryAiAction';
import {
    buildFieldPositionById,
    getAiHistoryForOperation,
    getOperationReferenceDate,
} from './raisedBedOperationHistory';

const PHOTO_PAGE_SIZE = 20;

type RaisedBedPhotosModalProps = {
    gardenId: number;
    raisedBedId: number;
    subjectName: string;
    positionIndex?: number;
    triggerPlacement?: 'hud' | 'header' | 'cover';
    hideWhenEmpty?: boolean;
    className?: string;
};

function getDateLabel(value: string | Date | null | undefined) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleDateString('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function getPhotoCountLabel(photoCount: number) {
    if (photoCount === 1) {
        return '1 fotografija';
    }

    if (photoCount > 1 && photoCount < 5) {
        return `${photoCount} fotografije`;
    }

    return `${photoCount} fotografija`;
}

function isGenericPhotoOperationName(name: string) {
    return /^fotografiranje\b/iu.test(name.trim());
}

function RaisedBedPhotoThumbnail({
    fallback,
    imageUrl,
}: {
    fallback?: ReactNode;
    imageUrl: string | undefined;
}) {
    return (
        <span className="relative flex size-full items-center justify-center overflow-hidden rounded-[inherit]">
            {imageUrl ? (
                <>
                    {/** biome-ignore lint/performance/noImgElement: Operation photos come from runtime data and can use external blob hosts. */}
                    <img
                        src={imageUrl}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                    />
                </>
            ) : (
                (fallback ?? (
                    <Camera className="size-5 text-muted-foreground" />
                ))
            )}
        </span>
    );
}

export function RaisedBedPhotosModal({
    gardenId,
    raisedBedId,
    subjectName,
    positionIndex,
    triggerPlacement = 'header',
    hideWhenEmpty = false,
    className,
}: RaisedBedPhotosModalProps) {
    const { data: currentGarden } = useCurrentGarden();
    const { data: operationsData } = useOperations();
    const history = useGardenOperations({
        includeCompleted: true,
        pageSize: PHOTO_PAGE_SIZE,
        raisedBedId,
        positionIndex,
    });
    const { data: aiHistoryEntries } = useRaisedBedAiHistory(
        gardenId,
        raisedBedId,
        { enabled: Boolean(gardenId && raisedBedId) },
    );
    const fieldPositionById = useMemo(
        () => buildFieldPositionById(currentGarden),
        [currentGarden],
    );
    const operationDataById = useMemo(
        () =>
            new Map(
                (operationsData ?? []).map((operation) => [
                    operation.id,
                    operation,
                ]),
            ),
        [operationsData],
    );
    const photoOperations = useMemo(
        () =>
            sortOperationTasksNewestFirst(
                history.data?.pages
                    .flatMap((page) => page.items)
                    .filter((operation) => operation.imageUrls.length > 0) ??
                    [],
            ),
        [history.data?.pages],
    );
    const photoCount = photoOperations.reduce(
        (count, operation) => count + operation.imageUrls.length,
        0,
    );
    const latestImageUrls = Array.from(
        new Set(photoOperations.flatMap((operation) => operation.imageUrls)),
    ).slice(0, 3);
    const latestImageUrl = latestImageUrls[0];
    const isFieldScoped = typeof positionIndex === 'number';
    const triggerLabel = isFieldScoped
        ? `Fotografije biljke ${subjectName}`
        : `Fotografije gredice ${subjectName}`;
    const modalTitle = isFieldScoped
        ? 'Fotografije biljke'
        : 'Fotografije gredice';
    const shouldSearchOlderPhotos =
        hideWhenEmpty || triggerPlacement === 'cover';
    const shouldFetchOlderPhotos =
        shouldSearchOlderPhotos &&
        photoCount === 0 &&
        !history.isLoading &&
        !history.isError &&
        !history.isFetchingNextPage &&
        Boolean(history.hasNextPage);

    useEffect(() => {
        if (!shouldFetchOlderPhotos) {
            return;
        }

        void history.fetchNextPage();
    }, [history.fetchNextPage, shouldFetchOlderPhotos]);

    if (hideWhenEmpty && (history.isError || photoCount === 0)) {
        return null;
    }

    const stackedThumbnail = (
        <span className="relative flex size-full items-center justify-center overflow-hidden rounded-[inherit] bg-card">
            {latestImageUrls.length > 0 ? (
                latestImageUrls.map((imageUrl, index) => (
                    <span
                        key={imageUrl}
                        className="absolute overflow-hidden rounded-[inherit] border border-white/80 bg-muted shadow-sm"
                        style={{
                            inset: index === 0 ? 0 : `${index * 4}px`,
                            zIndex: latestImageUrls.length - index,
                            transform:
                                index === 0
                                    ? undefined
                                    : `translate(${index * 4}px, ${index * -3}px) rotate(${index * 4}deg)`,
                        }}
                    >
                        {/** biome-ignore lint/performance/noImgElement: Operation photos come from runtime data and can use external blob hosts. */}
                        <img
                            src={imageUrl}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                        />
                    </span>
                ))
            ) : (
                <Camera className="size-5 text-muted-foreground" />
            )}
        </span>
    );

    const trigger =
        triggerPlacement === 'cover' ? (
            <button
                type="button"
                className={cx(
                    'relative inline-flex size-20 shrink-0 items-center justify-center rounded-xl p-0 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2',
                    latestImageUrl
                        ? 'overflow-hidden shadow-sm ring-1 ring-black/10'
                        : 'overflow-visible',
                    className,
                )}
                aria-label={triggerLabel}
                data-raised-bed-photo-trigger={triggerPlacement}
                title={triggerLabel}
            >
                <RaisedBedPhotoThumbnail
                    imageUrl={latestImageUrl}
                    fallback={
                        <BlockImage
                            blockName="Raised_Bed"
                            width={80}
                            height={80}
                            className="size-full"
                        />
                    }
                />
            </button>
        ) : triggerPlacement === 'hud' ? (
            <button
                type="button"
                className={cx(
                    'relative inline-flex size-10 min-h-10 shrink-0 items-center justify-center overflow-hidden rounded-xl p-0 shadow-sm ring-1 ring-black/10 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2',
                    className,
                )}
                aria-label={triggerLabel}
                data-raised-bed-photo-trigger={triggerPlacement}
                title={triggerLabel}
            >
                <RaisedBedPhotoThumbnail imageUrl={latestImageUrl} />
            </button>
        ) : (
            <button
                type="button"
                className={cx(
                    'relative inline-flex size-14 shrink-0 items-center justify-center rounded-2xl border bg-card p-1 shadow-xs transition hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2',
                    className,
                )}
                aria-label={triggerLabel}
                data-raised-bed-photo-trigger={triggerPlacement}
                title={triggerLabel}
            >
                {stackedThumbnail}
                {photoCount > 0 && (
                    <span
                        className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm"
                        data-raised-bed-photo-count
                    >
                        {photoCount}
                    </span>
                )}
            </button>
        );

    return (
        <Modal
            title={modalTitle}
            className="overflow-x-hidden md:max-w-5xl md:border-tertiary md:border-b-4"
            trigger={trigger}
        >
            <Stack
                spacing={4}
                className="min-w-0 max-w-full"
                data-raised-bed-photos-modal
            >
                <Row
                    spacing={4}
                    className="min-w-0 flex-wrap items-start justify-between gap-y-2"
                >
                    <Stack spacing={1} className="min-w-0">
                        <Typography level="h4" component="h1">
                            {modalTitle}
                        </Typography>
                        <Typography level="body2" secondary>
                            {subjectName}
                        </Typography>
                    </Stack>
                    {photoCount > 0 && (
                        <Chip variant="soft">
                            {getPhotoCountLabel(photoCount)}
                        </Chip>
                    )}
                </Row>
                {history.isError && (
                    <Alert color="danger">
                        Došlo je do pogreške prilikom učitavanja fotografija.
                    </Alert>
                )}
                {history.isLoading && (
                    <Spinner
                        loading
                        loadingLabel="Učitavanje fotografija..."
                        className="mx-auto my-8 flex items-center justify-center"
                    />
                )}
                {!history.isLoading && !history.isError && photoCount === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema zabilježenih fotografija.
                    </NoDataPlaceholder>
                )}
                {photoOperations.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                        {photoOperations.map((operation) => {
                            const operationData =
                                operation.entityTypeName === 'operation'
                                    ? operationDataById.get(operation.entityId)
                                    : undefined;
                            const entryName =
                                operationData?.information.label ??
                                operation.targetLabel;
                            const showEntryName =
                                !isGenericPhotoOperationName(entryName);
                            const operationPositionIndex =
                                positionIndex ??
                                (operation.raisedBedFieldId
                                    ? fieldPositionById.get(
                                          operation.raisedBedFieldId,
                                      )
                                    : undefined);
                            const referenceDate =
                                getOperationReferenceDate(operation);
                            const operationDateLabel =
                                getDateLabel(referenceDate);
                            const completionNotes =
                                operation.completionNotes?.trim();
                            const imageAltBase = showEntryName
                                ? entryName
                                : `${modalTitle} ${subjectName}`;

                            return (
                                <div
                                    key={`${operation.entityTypeName}-${operation.id}`}
                                    className="rounded-xl border bg-card p-3 shadow-xs"
                                    data-raised-bed-photo-entry
                                >
                                    <Stack spacing={3}>
                                        <Row
                                            spacing={2}
                                            className="min-w-0 flex-wrap items-start justify-between gap-y-2"
                                        >
                                            <Stack
                                                spacing={0.5}
                                                className="min-w-0"
                                            >
                                                {showEntryName && (
                                                    <Typography
                                                        level="body1"
                                                        semiBold
                                                        className="break-words"
                                                    >
                                                        {entryName}
                                                    </Typography>
                                                )}
                                                <Typography
                                                    level={
                                                        showEntryName
                                                            ? 'body3'
                                                            : 'body1'
                                                    }
                                                    semiBold={!showEntryName}
                                                    secondary={showEntryName}
                                                >
                                                    {operationDateLabel ??
                                                        'Fotografija'}
                                                </Typography>
                                            </Stack>
                                            {operation.imageUrls.length > 1 && (
                                                <Chip variant="soft">
                                                    {getPhotoCountLabel(
                                                        operation.imageUrls
                                                            .length,
                                                    )}
                                                </Chip>
                                            )}
                                        </Row>
                                        <ImageGallery
                                            images={operation.imageUrls.map(
                                                (imageUrl, imageIndex) => ({
                                                    src: imageUrl,
                                                    alt: `${imageAltBase} ${imageIndex + 1}`,
                                                }),
                                            )}
                                            previewAs="div"
                                            previewVariant="grid"
                                            previewWidth={220}
                                            previewLimitBeforeStack={5}
                                        />
                                        {completionNotes && (
                                            <Typography
                                                level="body2"
                                                className="break-words"
                                            >
                                                {completionNotes}
                                            </Typography>
                                        )}
                                        <Row
                                            spacing={2}
                                            className="items-center justify-end gap-y-2"
                                        >
                                            <RaisedBedDiaryAiAction
                                                gardenId={gardenId}
                                                raisedBedId={raisedBedId}
                                                positionIndex={
                                                    operationPositionIndex
                                                }
                                                entryName={entryName}
                                                imageUrls={operation.imageUrls}
                                                referenceDate={referenceDate}
                                                historyEntries={getAiHistoryForOperation(
                                                    {
                                                        imageUrls:
                                                            operation.imageUrls,
                                                        entries:
                                                            aiHistoryEntries,
                                                    },
                                                )}
                                            />
                                        </Row>
                                    </Stack>
                                </div>
                            );
                        })}
                    </div>
                )}
                {history.hasNextPage && (
                    <Button
                        variant="plain"
                        size="sm"
                        loading={history.isFetchingNextPage}
                        onClick={() => history.fetchNextPage()}
                        endDecorator={<Navigate className="size-4" />}
                    >
                        Prikaži više
                    </Button>
                )}
            </Stack>
        </Modal>
    );
}
